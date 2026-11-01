package main

import (
	"fmt"
	"html"
	"net/http"
	"sort"
	"strconv"
	"strings"
)

// robots.txt and the sitemaps: /sitemap.xml lists pages.xml (home, dictionaries, abbreviations, about),
// bookpage.xml (the v1 book pages, 88% of the search impressions in 2026), words-<n>.xml and pali-<n>.xml
// (the word pages, sitemapSize a file, with the date their entries last changed).

const sitemapSize = 40000

func (a *App) handleRobots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprintf(w, "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /stats\nSitemap: %s/sitemap.xml\n", a.cfg.Site)
}

func xmlHeader(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
}

func (a *App) handleSitemapIndex(w http.ResponseWriter, r *http.Request) {
	words, pali, err := a.eng.SitemapCounts(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	xmlHeader(w)
	fmt.Fprint(w, `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	files := []string{"pages.xml", "bookpage.xml"}
	for i := 0; i*sitemapSize < words; i++ {
		files = append(files, fmt.Sprintf("words-%d.xml", i+1))
	}
	for i := 0; i*sitemapSize < pali; i++ {
		files = append(files, fmt.Sprintf("pali-%d.xml", i+1))
	}
	for _, f := range files {
		fmt.Fprintf(w, "<sitemap><loc>%s/sitemaps/%s</loc></sitemap>", a.cfg.Site, f)
	}
	fmt.Fprint(w, `</sitemapindex>`)
}

func (a *App) handleSitemap(w http.ResponseWriter, r *http.Request) {
	name, ok := strings.CutSuffix(r.PathValue("file"), ".xml")
	if !ok {
		http.NotFound(w, r)
		return
	}
	var urls []string
	var lastmods []string
	switch {
	case name == "pages":
		urls = append(urls, "/", "/about", "/dict/pali")
		for _, d := range a.eng.DictInfos() {
			urls = append(urls, "/dict/"+d.Code)
			if len(d.Abbrevs) > 0 {
				id := d.Code
				if d.V1 != "" {
					id = d.V1
				}
				urls = append(urls, "/abbreviations/"+id)
			}
		}
	case name == "bookpage":
		pages, err := a.eng.BookPages(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		for _, p := range pages {
			urls = append(urls, fmt.Sprintf("/bookpage/%s/%d", p.V1, p.Page))
		}
	case strings.HasPrefix(name, "words-") || strings.HasPrefix(name, "pali-"):
		pali := strings.HasPrefix(name, "pali-")
		n, err := strconv.Atoi(name[strings.Index(name, "-")+1:])
		if err != nil || n < 1 {
			http.NotFound(w, r)
			return
		}
		ws, err := a.eng.SitemapWords(r.Context(), pali, (n-1)*sitemapSize, sitemapSize)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if len(ws) == 0 {
			http.NotFound(w, r)
			return
		}
		for _, x := range ws {
			urls = append(urls, wordPath(x.Word))
			lastmods = append(lastmods, x.Lastmod)
		}
	default:
		http.NotFound(w, r)
		return
	}
	xmlHeader(w)
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	for i, u := range urls {
		fmt.Fprintf(&b, "<url><loc>%s</loc>", html.EscapeString(a.cfg.Site+u))
		if i < len(lastmods) && lastmods[i] != "" {
			fmt.Fprintf(&b, "<lastmod>%s</lastmod>", lastmods[i])
		}
		b.WriteString("</url>")
	}
	b.WriteString(`</urlset>`)
	w.Write([]byte(b.String()))
}

func sortedKeys(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
