package main

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

var staticExt = map[string]bool{".js": true, ".css": true, ".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
	".svg": true, ".ico": true, ".json": true, ".txt": true, ".map": true, ".woff": true, ".woff2": true, ".ttf": true,
	".webmanifest": true, ".xml": true, ".html": true, ".pdf": true}

// v1 files that are linked from elsewhere
var legacyPaths = map[string]string{"/index.html": "/", "/UN-Abhaya.ttf": "/"}

func (a *App) handleStatic(w http.ResponseWriter, r *http.Request) {
	p := path.Clean("/" + r.URL.Path)
	if target, ok := legacyPaths[p]; ok {
		http.Redirect(w, r, target, http.StatusMovedPermanently)
		return
	}
	if p != "/" && a.distDir != "" {
		full := filepath.Join(a.distDir, filepath.FromSlash(p))
		if st, err := os.Stat(full); err == nil && !st.IsDir() {
			switch {
			case strings.HasPrefix(p, "/assets/"):
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			case p == "/sw.js":
				w.Header().Set("Cache-Control", "no-cache")
			case p == "/.well-known/apple-app-site-association":
				w.Header().Set("Content-Type", "application/json") // no extension: Apple wants json
				w.Header().Set("Cache-Control", "public, max-age=3600")
			default:
				w.Header().Set("Cache-Control", "public, max-age=86400")
			}
			http.ServeFile(w, r, full)
			return
		}
	}
	// missing files under the static folders are 404, everything else is a page of the app (a word may contain a dot)
	if strings.HasPrefix(p, "/assets/") || strings.HasPrefix(p, "/images/") || strings.HasPrefix(p, "/fonts/") ||
		(staticExt[strings.ToLower(path.Ext(p))] && !strings.Contains(strings.TrimPrefix(p, "/"), "/") && strings.Count(p, ".") == 1) {
		http.NotFound(w, r)
		return
	}
	a.serveIndex(w, r)
}
