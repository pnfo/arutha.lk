// arutha.lk server: the web app (web/dist), the read-only API over the engine (/api/<op>), server side rendering
// of the word, book and dictionary pages for search engines, sitemaps, and the redirects of v1 links.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"arutha.lk/server/engine"
)

// APPNAME is shown in /api/health.
const APPNAME = "arutha.lk v3.0"

func main() {
	listen := flag.String("listen", "127.0.0.1:3000", "address to listen on")
	rootPath := flag.String("root-path", "", "folder containing web/dist (or dist/) and db/, relative to the binary or absolute")
	dbPath := flag.String("db", "", "dict.db (default <root>/db/dict.db)")
	site := flag.String("site", "https://arutha.lk", "public url (canonical links, sitemaps)")
	flag.Parse()

	root, err := findRoot(*rootPath, *dbPath)
	if err != nil {
		log.Fatal(err)
	}
	app, err := NewApp(Config{Root: root, DBPath: *dbPath, Site: *site})
	if err != nil {
		log.Fatal(err)
	}
	if err := app.stats.start(*metricsPath, *geoPath, os.Getenv("STATS_PASSWORD")); err != nil {
		log.Fatal(err)
	}
	log.Printf("%s on http://%s, serving %s (content %s)", APPNAME, *listen, root, app.eng.Meta["content_hash"])
	srv := &http.Server{Addr: *listen, Handler: app.Handler(), ReadHeaderTimeout: 10 * time.Second, WriteTimeout: 60 * time.Second,
		IdleTimeout: 120 * time.Second}
	go app.guard.logEvery(10 * time.Minute) // load counters in the journal
	log.Fatal(srv.ListenAndServe())
}

// findRoot locates the folder holding the web build and the db (deploy folder or repo checkout).
func findRoot(rootPath, dbPath string) (string, error) {
	var candidates []string
	if filepath.IsAbs(rootPath) {
		candidates = append(candidates, rootPath)
	} else {
		if exe, err := os.Executable(); err == nil {
			candidates = append(candidates, filepath.Join(filepath.Dir(exe), rootPath))
		}
		if cwd, err := os.Getwd(); err == nil {
			candidates = append(candidates, filepath.Join(cwd, rootPath), cwd, filepath.Join(cwd, ".."))
		}
	}
	for _, c := range candidates {
		if dbPath != "" {
			if distDir(c) != "" {
				return filepath.Clean(c), nil
			}
			continue
		}
		if _, err := os.Stat(filepath.Join(c, "db", "dict.db")); err == nil {
			return filepath.Clean(c), nil
		}
	}
	return "", fmt.Errorf("could not find db/dict.db in %v (use -root-path or -db)", candidates)
}

func distDir(root string) string {
	for _, d := range []string{filepath.Join("web", "dist"), "dist"} { // repo checkout first, release layout second
		if _, err := os.Stat(filepath.Join(root, d, "index.html")); err == nil {
			return filepath.Join(root, d)
		}
	}
	return ""
}

// Config of the app.
type Config struct {
	Root   string
	DBPath string // default <Root>/db/dict.db
	Site   string
	// IndexHTML overrides dist/index.html (tests)
	IndexHTML string
}

// App is the http application.
type App struct {
	cfg       Config
	eng       *engine.Engine
	distDir   string
	indexHTML string
	etag      string
	ssr       *ssrCache
	guard     *guard
	stats     *stats
}

func NewApp(cfg Config) (*App, error) {
	if cfg.Site == "" {
		cfg.Site = "https://arutha.lk"
	}
	dbPath := cfg.DBPath
	if dbPath == "" {
		dbPath = filepath.Join(cfg.Root, "db", "dict.db")
	}
	eng, err := engine.Open(dbPath)
	if err != nil {
		return nil, err
	}
	a := &App{cfg: cfg, eng: eng, distDir: distDir(cfg.Root), indexHTML: cfg.IndexHTML, ssr: newSSRCache(12 << 20), guard: newGuard(), stats: newStats()}
	a.etag = `W/"` + eng.Meta["content_hash"] + `"`
	if a.indexHTML == "" {
		if a.distDir == "" {
			return nil, fmt.Errorf("web build not found in %s/web/dist or %s/dist", cfg.Root, cfg.Root)
		}
		b, err := os.ReadFile(filepath.Join(a.distDir, "index.html"))
		if err != nil {
			return nil, err
		}
		a.indexHTML = string(b)
	}
	// the html of the pages changes with the data and with the web build
	a.etag = `W/"` + eng.Meta["content_hash"] + "-" + shortHash(a.indexHTML) + `"`
	return a, nil
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", a.handleHealth)
	mux.HandleFunc("GET /api/{op}", a.handleAPI)
	mux.HandleFunc("POST /api/{op}", a.handleAPI)
	a.stats.routes(mux) // /api/country, /api/beacon, /stats (stats.go)
	mux.HandleFunc("GET /robots.txt", a.handleRobots)
	mux.HandleFunc("GET /sitemap.xml", a.handleSitemapIndex)
	mux.HandleFunc("GET /sitemap.txt", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/sitemap.xml", http.StatusMovedPermanently)
	})
	mux.HandleFunc("GET /sitemaps/{file}", a.handleSitemap)
	mux.HandleFunc("GET /", a.handleStatic)
	return recoverMiddleware(securityHeaders(a.stats.count(gzipMiddleware(mux))))
}
