package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

const testIndex = `<!DOCTYPE html><html lang="si"><head><title>x</title><meta name="description" content="x"></head><body><div id="app"></div></body></html>`

func testApp(t *testing.T) http.Handler {
	t.Helper()
	a, err := NewApp(Config{Root: "..", DBPath: "../e2e/fixtures/db/dict.db", Site: "https://arutha.lk", IndexHTML: testIndex})
	if err != nil {
		t.Fatal(err)
	}
	return a.Handler()
}

func get(t *testing.T, h http.Handler, path string) (*http.Response, string) {
	t.Helper()
	req := httptest.NewRequest("GET", path, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 test")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	b, _ := io.ReadAll(w.Result().Body)
	return w.Result(), string(b)
}

func esc(w string) string { return "/" + url.PathEscape(w) }

func TestPages(t *testing.T) {
	h := testApp(t)
	cases := []struct {
		path     string
		status   int
		contains []string
	}{
		{"/", 200, []string{"<title>අරුත.lk සිංහල ශබ්දකෝෂය</title>", `rel="canonical" href="https://arutha.lk/"`, "SearchAction"}},
		{esc("ධම්ම"), 200, []string{"ධම්ම – තේරුම, අර්ථය", `"@type":"DefinedTerm"`, `id="ssr-data"`, "Digital Pāḷi Dictionary", `<p class="roman">dhamma</p>`}},
		{"/love", 200, []string{"love meaning in Sinhala", `href="https://arutha.lk/love"`, `<a href="/`}},
		{"/word/about", 200, []string{"about meaning in Sinhala", `href="https://arutha.lk/word/about"`}},
		{"/search/love", 200, []string{`noindex,follow`, `id="ssr-data"`}},
		{"/bookpage/sankshiptha/1", 200, []string{"සංක්ෂිප්ත සිංහල ශබ්දකෝෂය පොතේ 1 පිටුවේ වචන", `rel="next"`}},
		{"/abbreviations/sankshiptha", 200, []string{"Abbreviations of", "<dt>"}},
		{"/dict/pali", 200, []string{"පාලි සිංහල ශබ්දකෝෂය", "/bookpage/pali_buddhadatta/"}},
		{"/dict/dpd", 200, []string{"Digital Pāḷi Dictionary"}},
		{"/dict/si-sumangala", 200, []string{`class="about"`, "tipitaka.lk/library/162", "intro_sumangala.pdf"}},
		{"/dict/si-buddhadatta", 200, []string{"<details>", "පොල්වත්තේ බුද්ධදත්ත ස්ථවිර"}},
		{"/no-such-word-xyz", 404, []string{"noindex"}},
		{"/sql-query", 404, nil},
		{"/robots.txt", 200, []string{"Sitemap: https://arutha.lk/sitemap.xml", "Disallow: /api/"}},
		{"/sitemap.xml", 200, []string{"sitemaps/pages.xml", "sitemaps/bookpage.xml", "sitemaps/words-1.xml", "sitemaps/pali-1.xml"}},
		{"/sitemaps/pages.xml", 200, []string{"https://arutha.lk/dict/pali", "https://arutha.lk/abbreviations/sankshiptha"}},
		{"/sitemaps/bookpage.xml", 200, []string{"https://arutha.lk/bookpage/english_to_sinhala/2638"}},
		{"/sitemaps/words-1.xml", 200, []string{"https://arutha.lk/love</loc><lastmod>"}},
		{"/sitemaps/words-9.xml", 404, nil},
		{"/api/search?q=love", 200, []string{`"cards"`}},
		{"/api/nope", 404, []string{"not_found"}},
		{"/assets/missing.js", 404, nil},
	}
	for _, c := range cases {
		res, body := get(t, h, c.path)
		if res.StatusCode != c.status {
			t.Errorf("%s: status %d, want %d", c.path, res.StatusCode, c.status)
		}
		for _, s := range c.contains {
			if !strings.Contains(body, s) {
				t.Errorf("%s: no %q in %.300s", c.path, s, body)
			}
		}
	}
}

func TestRedirects(t *testing.T) {
	h := testApp(t)
	for from, to := range map[string]string{
		"/LOVE":         "/love",
		"/word/love":    "/love",
		"/search/love.": "/love",
		"/search/" + url.PathEscape("ධර්මය."): esc("ධර්මය"),
		"/bookpage/akshara/7":                 "/bookpage/akshara_vinyasa/7",
		"/abbreviations/sinhala-english":      "/abbreviations/sinhala_to_english",
		"/sitemap.txt":                        "/sitemap.xml",
		"/dhamma":                             "",              // the English headword dhamma: a page, no redirect
		esc("ක්රියාව"):                        esc("ක්‍රියාව"), // without the ZWJ: the canonical spelling
	} {
		res, _ := get(t, h, from)
		if to == "" {
			if res.StatusCode != 200 {
				t.Errorf("%s: status %d", from, res.StatusCode)
			}
			continue
		}
		if res.StatusCode != http.StatusMovedPermanently || res.Header.Get("Location") != to {
			t.Errorf("%s: %d -> %q, want 301 -> %q", from, res.StatusCode, res.Header.Get("Location"), to)
		}
	}
}

func TestSSREscapes(t *testing.T) {
	h := testApp(t)
	_, body := get(t, h, "/search/"+url.PathEscape(`<script>alert(1)</script>`))
	if strings.Contains(body, "<script>alert") {
		t.Errorf("unescaped query in the page")
	}
}
