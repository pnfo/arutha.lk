package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"

	"arutha.lk/server/engine"
)

// SSR-lite: the pages are rendered into index.html - title, description, canonical, JSON-LD, an <article id="ssr">
// with the content (readable without JS and by crawlers) and <script id="ssr-data"> with the API responses the page
// needs (web/src/data/api.ts readSsrData). The web app replaces the article when it starts.

// reserved: the first url segments that are not words (web/src/router.ts, shared/reserved.json, checked by a test).
// A headword that is one of them has its page at /word/<w>.
var reserved = map[string]bool{"search": true, "word": true, "bookpage": true, "abbreviations": true, "dict": true, "about": true,
	"settings": true, "bookmarks": true, "history": true, "stats": true, "api": true, "assets": true, "images": true, "fonts": true,
	"sitemaps": true, "sitemap.xml": true, "sitemap.txt": true, "robots.txt": true, "manifest.webmanifest": true, "sw.js": true,
	"favicon.ico": true, "privacy-policy.html": true, ".well-known": true, "offline.html": true, "index.html": true}

const siteName = "අරුත.lk"
const homeTitle = "අරුත.lk සිංහල ශබ්දකෝෂය"
const homeDesc = "මුල් පිටුව Home Page - අරුත.lk සිංහල ශබ්දකෝෂය. වචනවල තේරුම් අර්ථයන් සොයන්න. Sinhala, English and Pali dictionaries."

var (
	titleRe   = regexp.MustCompile(`(?s)<title>.*?</title>`)
	descRe    = regexp.MustCompile(`<meta name="description"[^>]*>`)
	appDivRe  = regexp.MustCompile(`<div id="app"></div>`)
	dictRefRe = regexp.MustCompile(`<a data-dict="([^"]*)"`)
	tagRe     = regexp.MustCompile(`<[^>]*>`)
)

// the API responses embedded in a page are left out above this size (the client fetches them)
const maxSSRData = 256 << 10

type page struct {
	status   int
	html     string
	redirect string
}

// cacheKey must equal web/src/data/api.ts cacheKey(): op|JSON(params with sorted keys, string values)
func cacheKey(op string, params map[string]string) string {
	b, _ := marshalNoEscape(params) // encoding/json sorts map keys
	return op + "|" + string(b)
}

// ssrCache keeps rendered pages, bounded by their size
type ssrCache struct {
	mu       sync.Mutex
	maxBytes int
	bytes    int
	order    []string
	items    map[string]page
}

func newSSRCache(maxBytes int) *ssrCache {
	return &ssrCache{maxBytes: maxBytes, items: map[string]page{}}
}

func (c *ssrCache) get(k string) (page, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	p, ok := c.items[k]
	return p, ok
}

func (c *ssrCache) put(k string, p page) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if old, ok := c.items[k]; ok {
		c.bytes -= len(old.html)
	} else {
		c.order = append(c.order, k)
	}
	c.items[k] = p
	c.bytes += len(p.html)
	for c.bytes > c.maxBytes && len(c.order) > 1 {
		c.bytes -= len(c.items[c.order[0]].html)
		delete(c.items, c.order[0])
		c.order = c.order[1:]
	}
}

// render: a cached page, or a page rendered in one of the ssr slots (guard.go). ok false: no slot in time
func (a *App) render(ctx context.Context, u *url.URL) (p page, ok bool) {
	key := u.EscapedPath()
	if p, ok := a.ssr.get(key); ok {
		a.guard.stats.cacheHits.Add(1)
		return p, true
	}
	if !a.guard.ssr.acquire(ctx, ssrWait) {
		return page{}, false
	}
	defer a.guard.ssr.release()
	a.guard.stats.renders.Add(1)
	p = a.renderPath(ctx, key)
	if p.status == 200 || p.status == 404 || p.status == http.StatusMovedPermanently {
		a.ssr.put(key, p)
	}
	return p, true
}

// wordPath is the url of a headword's page.
func wordPath(w string) string {
	if reserved[w] || reserved[strings.ToLower(w)] {
		return "/word/" + url.PathEscape(w)
	}
	return "/" + url.PathEscape(w)
}

func (a *App) baseHTML() string {
	return strings.Replace(a.indexHTML, "</head>", fmt.Sprintf(`<meta name="arutha-content" content="%s"></head>`, html.EscapeString(a.eng.Meta["content_hash"])), 1)
}

// segments splits an escaped path into its unescaped segments ("/a%2Fb/c" -> ["a/b", "c"])
func segments(escaped string) ([]string, bool) {
	var out []string
	for _, s := range strings.Split(strings.Trim(escaped, "/"), "/") {
		u, err := url.PathUnescape(s)
		if err != nil || !utf8.ValidString(u) {
			return nil, false
		}
		out = append(out, u)
	}
	return out, true
}

func (a *App) renderPath(ctx context.Context, escaped string) page {
	parts, ok := segments(escaped)
	if !ok {
		return a.notFound()
	}
	first := parts[0]
	switch {
	case len(parts) == 1 && first == "":
		return a.homePage(ctx)
	case len(parts) == 2 && first == "search":
		return a.searchPage(ctx, parts[1])
	case len(parts) == 1 && first == "search":
		return a.simplePage("සෙවීම / Search | "+siteName, homeDesc, "", true)
	case len(parts) == 2 && first == "word":
		if !reserved[parts[1]] && !reserved[strings.ToLower(parts[1])] {
			return page{status: http.StatusMovedPermanently, redirect: wordPath(parts[1])}
		}
		return a.wordPage(ctx, parts[1])
	case len(parts) == 3 && first == "bookpage":
		n, err := strconv.Atoi(parts[2])
		if err != nil {
			return a.notFound()
		}
		return a.bookPage(ctx, parts[1], n)
	case len(parts) == 2 && first == "abbreviations":
		return a.abbrevPage(ctx, parts[1])
	case len(parts) == 2 && first == "dict":
		return a.dictPage(ctx, parts[1])
	case len(parts) == 1 && first == "about":
		return a.simplePage("උපදෙස් සහ අප ගැන / Help and About Us | "+siteName, "උපදෙස් සහ අප ගැන / Help and About Us - අරුත.lk සිංහල ශබ්දකෝෂය.", a.cfg.Site+"/about", false)
	case len(parts) == 1 && first == "bookmarks":
		return a.simplePage("තරු යෙදූ - Bookmarks | "+siteName, "ඔබ විසින් තරු යොදන ලද වචන - අරුත.lk සිංහල ශබ්දකෝෂය", "", true)
	case len(parts) == 1 && first == "history":
		return a.simplePage("History | "+siteName, homeDesc, "", true)
	case len(parts) == 1 && first == "settings":
		return a.simplePage("Settings | "+siteName, homeDesc, "", true)
	case len(parts) == 1 && !reserved[first]:
		return a.wordPage(ctx, first)
	}
	return a.notFound()
}

func (a *App) notFound() page {
	p := a.simplePage("Not found | "+siteName, homeDesc, "", true)
	p.status = 404
	return p
}

func (a *App) simplePage(title, desc, canonical string, noindex bool) page {
	return a.assemble(title, desc, canonical, noindex, nil, "", nil)
}

// assemble puts a page together.
func (a *App) assemble(title, desc, canonical string, noindex bool, ld any, article string, data map[string]any) page {
	var head strings.Builder
	fmt.Fprintf(&head, `<meta name="description" content="%s">`, html.EscapeString(desc))
	if canonical != "" {
		fmt.Fprintf(&head, `<link rel="canonical" href="%s"><meta property="og:url" content="%s">`, html.EscapeString(canonical), html.EscapeString(canonical))
	}
	if noindex {
		head.WriteString(`<meta name="robots" content="noindex,follow">`)
	}
	fmt.Fprintf(&head, `<meta property="og:title" content="%s"><meta property="og:description" content="%s"><meta property="og:type" content="website">`,
		html.EscapeString(title), html.EscapeString(desc))
	if ld != nil {
		ldJSON, _ := json.Marshal(ld) // escapes < > &
		fmt.Fprintf(&head, `<script type="application/ld+json">%s</script>`, ldJSON)
	}
	tail := `<div id="app"></div>`
	if len(data) > 0 {
		var dataJSON bytes.Buffer
		enc := json.NewEncoder(&dataJSON) // escapes < > & so the payload can not close the script tag
		enc.Encode(data)
		if dataJSON.Len() <= maxSSRData {
			tail += `<script type="application/json" id="ssr-data">` + strings.TrimSpace(dataJSON.String()) + `</script>`
		}
	}
	out := a.baseHTML()
	out = titleRe.ReplaceAllLiteralString(out, "<title>"+html.EscapeString(title)+"</title>")
	out = descRe.ReplaceAllLiteralString(out, "")
	out = strings.Replace(out, "</head>", head.String()+"</head>", 1)
	out = appDivRe.ReplaceAllLiteralString(out, article+tail)
	return page{status: 200, html: out}
}

// meaningHTML: a meaning of dict.db (built from escaped text with a small markup vocabulary) with its cross
// references as links for crawlers
func meaningHTML(m string) string {
	return dictRefRe.ReplaceAllStringFunc(m, func(s string) string {
		w := html.UnescapeString(dictRefRe.FindStringSubmatch(s)[1])
		return fmt.Sprintf(`<a href="%s" data-dict="%s"`, html.EscapeString(wordPath(w)), html.EscapeString(w))
	})
}

func plainText(m string) string {
	return strings.Join(strings.Fields(html.UnescapeString(tagRe.ReplaceAllString(strings.ReplaceAll(m, "<br>", "; "), " "))), " ")
}

func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)[:n]
	if i := strings.LastIndex(string(r), " "); i > n/2 {
		return string(r)[:i] + "…"
	}
	return string(r) + "…"
}

func (a *App) dictName(code string) string {
	if d := a.eng.DictByCode(code); d != nil {
		return d.Name
	}
	return code
}

// wordTitle: what people search for: "<w> තේරුම", "<w> meaning in Sinhala", Pali meaning
func wordTitle(p *engine.WordPage) string {
	switch {
	case strings.Contains(p.Src, "en"):
		return fmt.Sprintf("%s meaning in Sinhala – %s සිංහල තේරුම | %s", p.Word, p.Word, siteName)
	case p.Src == "pi":
		return fmt.Sprintf("%s (%s) – පාලි අර්ථය, Pali meaning | %s", p.Word, p.Roman, siteName)
	}
	return fmt.Sprintf("%s – තේරුම, අර්ථය | %s සිංහල ශබ්දකෝෂය", p.Word, siteName)
}

func (a *App) wordPage(ctx context.Context, w string) page {
	p, err := a.eng.Word(ctx, w, nil)
	if err != nil {
		if err != engine.ErrNotFound {
			log.Printf("ssr word %q: %v", w, err)
		}
		np := a.notFound()
		return np
	}
	if p.Word != w {
		// another spelling, Roman Pali, upper case: the canonical page
		return page{status: http.StatusMovedPermanently, redirect: wordPath(p.Word)}
	}
	canonical := a.cfg.Site + wordPath(p.Word)
	var meanings []string
	for _, e := range p.Entries {
		if len(meanings) == 3 {
			break
		}
		meanings = append(meanings, truncate(plainText(e.Meaning), 80))
	}
	for _, h := range p.Dpd {
		if len(meanings) == 4 {
			break
		}
		if h.Meaning != "" {
			meanings = append(meanings, h.Meaning)
		}
	}
	desc := truncate(p.Word+": "+strings.Join(meanings, " | "), 160)

	var art strings.Builder
	fmt.Fprintf(&art, `<article id="ssr" lang="si"><h1>%s</h1>`, html.EscapeString(p.Word))
	if p.Roman != "" {
		fmt.Fprintf(&art, `<p class="roman">%s</p>`, html.EscapeString(p.Roman))
	}
	var terms []any
	last := ""
	for _, e := range p.Entries {
		if e.Dict != last {
			if last != "" {
				art.WriteString(`</section>`)
			}
			fmt.Fprintf(&art, `<section><h2><a href="/dict/%s">%s</a></h2>`, e.Dict, html.EscapeString(a.dictName(e.Dict)))
			last = e.Dict
		}
		fmt.Fprintf(&art, `<p>%s</p>`, meaningHTML(e.Meaning))
		terms = append(terms, map[string]any{"@type": "DefinedTerm", "name": p.Word, "description": truncate(plainText(e.Meaning), 300),
			"inDefinedTermSet": map[string]any{"@type": "DefinedTermSet", "name": a.dictName(e.Dict), "url": a.cfg.Site + "/dict/" + e.Dict}})
	}
	if last != "" {
		art.WriteString(`</section>`)
	}
	if len(p.Dpd) > 0 {
		fmt.Fprintf(&art, `<section><h2><a href="/dict/dpd">%s</a></h2><ul>`, html.EscapeString(a.dictName("dpd")))
		for _, h := range p.Dpd {
			fmt.Fprintf(&art, `<li><b>%s</b> <i>%s</i> %s`, html.EscapeString(h.Lemma), html.EscapeString(h.Pos), html.EscapeString(h.Meaning))
			if h.Construction != "" {
				fmt.Fprintf(&art, ` [%s]`, html.EscapeString(plainText(h.Construction)))
			}
			art.WriteString(`</li>`)
			terms = append(terms, map[string]any{"@type": "DefinedTerm", "name": h.Lemma, "description": h.Meaning,
				"inDefinedTermSet": map[string]any{"@type": "DefinedTermSet", "name": "Digital Pāḷi Dictionary", "url": a.cfg.Site + "/dict/dpd"}})
		}
		art.WriteString(`</ul></section>`)
	}
	// links for crawlers: the book pages, the neighbours, other words of the same spelling
	art.WriteString(`<nav class="ssr-links">`)
	for _, b := range p.Pages {
		fmt.Fprintf(&art, `<a href="/bookpage/%s/%d">%s – %d</a> `, b.V1, b.Page, html.EscapeString(a.dictName(b.Dict)), b.Page)
	}
	for _, w := range p.Also {
		fmt.Fprintf(&art, `<a href="%s">%s</a> `, html.EscapeString(wordPath(w.Word)), html.EscapeString(w.Word))
	}
	if p.Prev != nil {
		fmt.Fprintf(&art, `<a href="%s" rel="prev">← %s</a> `, html.EscapeString(wordPath(p.Prev.Word)), html.EscapeString(p.Prev.Word))
	}
	if p.Next != nil {
		fmt.Fprintf(&art, `<a href="%s" rel="next">%s →</a>`, html.EscapeString(wordPath(p.Next.Word)), html.EscapeString(p.Next.Word))
	}
	art.WriteString(`</nav></article>`)
	ld := map[string]any{"@context": "https://schema.org", "@graph": terms}
	data := map[string]any{cacheKey("word", map[string]string{"w": p.Word}): p}
	return a.assemble(wordTitle(p), desc, canonical, false, ld, art.String(), data)
}

func (a *App) homePage(ctx context.Context) page {
	var art strings.Builder
	art.WriteString(`<article id="ssr" lang="si"><h1>අරුත.lk සිංහල ශබ්දකෝෂය</h1>`)
	art.WriteString(`<p>සිංහල වචනවල තේරුම්, ඉංග්‍රීසි වචනවල සිංහල තේරුම් සහ පාලි වචනවල අර්ථ එකම තැනකින් සොයන්න. ` +
		`Sinhala-Sinhala, English-Sinhala, Sinhala-English and Pali-Sinhala dictionaries with the Digital Pāḷi Dictionary.</p><ul>`)
	for _, d := range a.eng.DictInfos() {
		fmt.Fprintf(&art, `<li><a href="/dict/%s">%s</a> – %s (%d)</li>`, d.Code, html.EscapeString(d.Name), html.EscapeString(d.Desc), d.Entries)
	}
	art.WriteString(`</ul><p><a href="/dict/pali">පාලි සිංහල ශබ්දකෝෂය – Pali Sinhala dictionary</a></p></article>`)
	ld := map[string]any{"@context": "https://schema.org", "@type": "WebSite", "name": homeTitle, "url": a.cfg.Site + "/",
		"potentialAction": map[string]any{"@type": "SearchAction", "target": a.cfg.Site + "/search/{search_term_string}", "query-input": "required name=search_term_string"}}
	return a.assemble(homeTitle, homeDesc, a.cfg.Site+"/", false, ld, art.String(), nil)
}

func (a *App) searchPage(ctx context.Context, q string) page {
	// v1 share links /search/<word>. (exact): the word's page
	if strings.HasSuffix(q, ".") {
		if p, err := a.eng.Word(ctx, strings.TrimRight(q, "."), nil); err == nil {
			return page{status: http.StatusMovedPermanently, redirect: wordPath(p.Word)}
		}
	}
	title := fmt.Sprintf("“%s” සෙවුමේ ප්‍රතිඵල | %s", q, siteName)
	desc := fmt.Sprintf("“%s” යන සෙවුම සඳහා ගැළපෙන වචන - අරුත.lk සිංහල ශබ්දකෝෂය.", q)
	params := map[string]string{"q": q}
	res, err := a.eng.Search(ctx, q, nil, 0, 20)
	if err != nil {
		log.Printf("ssr search %q: %v", q, err)
		return a.simplePage(title, desc, "", true)
	}
	var art strings.Builder
	fmt.Fprintf(&art, `<article id="ssr" lang="si"><h1>“%s”</h1><ul>`, html.EscapeString(q))
	for _, c := range res.Cards {
		m := ""
		if len(c.Entries) > 0 {
			m = truncate(plainText(c.Entries[0].Meaning), 120)
		} else if len(c.Dpd) > 0 {
			m = c.Dpd[0].Meaning
		}
		fmt.Fprintf(&art, `<li><a href="%s">%s</a> %s</li>`, html.EscapeString(wordPath(c.Word)), html.EscapeString(c.Word), html.EscapeString(m))
	}
	art.WriteString(`</ul></article>`)
	return a.assemble(title, desc, "", true, nil, art.String(), map[string]any{cacheKey("search", params): res})
}

func (a *App) bookPage(ctx context.Context, dict string, n int) page {
	d := a.eng.DictByCode(dict)
	if d == nil || d.V1 == "" {
		return a.notFound()
	}
	if dict != d.V1 {
		return page{status: http.StatusMovedPermanently, redirect: fmt.Sprintf("/bookpage/%s/%d", d.V1, n)}
	}
	bp, err := a.eng.Browse(ctx, dict, n)
	if err != nil {
		return a.notFound()
	}
	title := fmt.Sprintf("%s පොතේ %d පිටුවේ වචන | %s", d.Name, n, siteName)
	var words []string
	for i, w := range bp.Words {
		if i == 6 {
			break
		}
		words = append(words, w.Word)
	}
	desc := fmt.Sprintf("%s පොතේ %d පිටුවේ වචන: %s - අරුත.lk සිංහල ශබ්දකෝෂය.", d.Name, n, strings.Join(words, ", "))
	var art strings.Builder
	fmt.Fprintf(&art, `<article id="ssr" lang="si"><h1>%s – %d</h1>`, html.EscapeString(d.Name), n)
	for _, w := range bp.Words {
		fmt.Fprintf(&art, `<section><h2><a href="%s">%s</a></h2>`, html.EscapeString(wordPath(w.Word)), html.EscapeString(w.Word))
		for _, e := range w.Entries {
			fmt.Fprintf(&art, `<p>%s</p>`, meaningHTML(e.Meaning))
		}
		art.WriteString(`</section>`)
	}
	art.WriteString(`<nav class="ssr-links">`)
	if n > 1 {
		fmt.Fprintf(&art, `<a href="/bookpage/%s/%d" rel="prev">← %d</a> `, d.V1, n-1, n-1)
	}
	if n < bp.Pages {
		fmt.Fprintf(&art, `<a href="/bookpage/%s/%d" rel="next">%d →</a> `, d.V1, n+1, n+1)
	}
	fmt.Fprintf(&art, `<a href="/dict/%s">%s</a></nav></article>`, d.Code, html.EscapeString(d.Name))
	data := map[string]any{cacheKey("browse", map[string]string{"dict": d.V1, "page": strconv.Itoa(n)}): bp}
	return a.assemble(title, desc, fmt.Sprintf("%s/bookpage/%s/%d", a.cfg.Site, d.V1, n), false, nil, art.String(), data)
}

func (a *App) abbrevPage(ctx context.Context, dict string) page {
	d := a.eng.DictByCode(dict)
	if d == nil {
		return a.notFound()
	}
	canon := d.Code
	if d.V1 != "" {
		canon = d.V1 // the indexed v1 urls
	}
	if dict != canon {
		return page{status: http.StatusMovedPermanently, redirect: "/abbreviations/" + canon}
	}
	title := fmt.Sprintf("සංකේත නිරූපණය කෙටි යෙදුම් / Abbreviations of %s | %s", d.Name, siteName)
	desc := fmt.Sprintf("සංකේත නිරූපණය කෙටි යෙදුම් / Abbreviations of %s - අරුත.lk සිංහල ශබ්දකෝෂය.", d.Name)
	var art strings.Builder
	fmt.Fprintf(&art, `<article id="ssr" lang="si"><h1>%s</h1><dl>`, html.EscapeString(d.Name))
	for _, k := range sortedKeys(d.Abbrevs) {
		fmt.Fprintf(&art, `<dt>%s</dt><dd>%s</dd>`, html.EscapeString(k), html.EscapeString(d.Abbrevs[k]))
	}
	art.WriteString(`</dl></article>`)
	return a.assemble(title, desc, a.cfg.Site+"/abbreviations/"+canon, false, nil, art.String(), nil)
}

func (a *App) dictPage(ctx context.Context, code string) page {
	dl, err := a.eng.DictPage(ctx, code)
	if err != nil {
		return a.notFound()
	}
	name, desc := "", ""
	about := plainText(dl.About)
	if code == "pali" {
		name = "පාලි සිංහල ශබ්දකෝෂය – Pali Sinhala Dictionary"
		desc = "පාලි වචනවල සිංහල අර්ථ: බුද්ධදත්ත හිමියන්ගේ පාලි-සිංහල අකාරාදිය, සුමඞ්ගල හිමියන්ගේ පාලි-සිංහල ශබ්දකෝෂය සහ Digital Pāḷi Dictionary (විභක්ති, ව්‍යාකරණ)."
	} else {
		name, desc = dl.Dicts[0].Name, dl.Dicts[0].Name+" – "+dl.Dicts[0].Desc
	}
	var art strings.Builder
	fmt.Fprintf(&art, `<article id="ssr" lang="si"><h1>%s</h1><p>%s</p>`, html.EscapeString(name), html.EscapeString(desc))
	if dl.About != "" {
		art.WriteString(`<section class="about">` + dl.About + `</section>`) // data/about (our own html)
	}
	for _, d := range dl.Dicts {
		fmt.Fprintf(&art, `<p><a href="/dict/%s"><b>%s</b></a>: %s (%d)</p>`, d.Code, html.EscapeString(d.Name), html.EscapeString(d.Desc), d.Entries)
	}
	if len(dl.Letters) > 0 {
		art.WriteString(`<nav class="ssr-letters">`)
		for _, l := range dl.Letters {
			fmt.Fprintf(&art, `<a href="/bookpage/%s/%d">%s</a> `, l.V1, l.Page, html.EscapeString(l.Letter))
		}
		art.WriteString(`</nav>`)
	}
	art.WriteString(`<ul>`)
	for _, w := range dl.Words {
		fmt.Fprintf(&art, `<li><a href="%s">%s</a></li>`, html.EscapeString(wordPath(w.Word)), html.EscapeString(w.Word))
	}
	art.WriteString(`</ul></article>`)
	ld := map[string]any{"@context": "https://schema.org", "@type": "DefinedTermSet", "name": name, "description": desc}
	data := map[string]any{cacheKey("dictpage", map[string]string{"dict": code}): dl}
	if about != "" && code != "pali" {
		desc = truncate(name+" – "+about, 200)
	}
	return a.assemble(name+" | "+siteName, truncate(desc, 200), a.cfg.Site+"/dict/"+code, false, ld, art.String(), data)
}

func (a *App) serveIndex(w http.ResponseWriter, r *http.Request) {
	bot := isBot(r)
	if bot {
		a.guard.stats.botRequests.Add(1)
	}
	if r.Header.Get("If-None-Match") == a.etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	p, ok := a.render(r.Context(), r.URL)
	if !ok {
		// busy: a crawler is asked to come back later, a person gets the app (it renders the page in the browser)
		w.Header().Set("Cache-Control", "no-store")
		if bot {
			a.guard.stats.shedBots.Add(1)
			w.Header().Set("Retry-After", retryBots)
			http.Error(w, "busy, please retry later", http.StatusServiceUnavailable)
			return
		}
		a.guard.stats.shedPeople.Add(1)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(a.baseHTML()))
		return
	}
	if p.redirect != "" {
		http.Redirect(w, r, p.redirect, p.status)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	if p.status == 200 {
		w.Header().Set("ETag", a.etag)
	}
	w.WriteHeader(p.status)
	w.Write([]byte(p.html))
}
