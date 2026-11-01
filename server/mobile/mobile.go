// Package mobile is the gomobile binding of the engine for the Android / iOS apps (M2: lk.pitaka.dictionary).
//
//	gomobile bind -target=android -javapkg lk.pitaka.dictionary.engine -o engine.aar arutha.lk/server/mobile
//	gomobile bind -target=ios,iossimulator -o Engine.xcframework arutha.lk/server/mobile
//
// The app copies dict.db out of its assets / bundle, opens it once and answers the web app's requests with Query (the
// JSON contract of dev-docs/native-bridge.md, the same as GET /api/<op>). gomobile exports only simple types, so the
// engine is wrapped.
package mobile

import (
	"encoding/json"

	"arutha.lk/server/engine"
)

// Engine is an open dict.db.
type Engine struct{ e *engine.Engine }

// Open opens dict.db (read-only).
func Open(dictPath string) (*Engine, error) {
	e, err := engine.Open(dictPath)
	if err != nil {
		return nil, err
	}
	return &Engine{e}, nil
}

// Query runs one request {"op": ..., params...} -> {"ok": result} or {"error": code, "message": text}.
func (m *Engine) Query(request string) string { return m.e.QueryJSON(request) }

// Version is the content hash of the db (the app copies a new db when its bundled one has another hash).
func (m *Engine) Version() string { return m.e.Meta["content_hash"] }

// Close closes the db.
func (m *Engine) Close() { m.e.Close() }

// Meta is the build information as JSON.
func (m *Engine) Meta() string {
	b, _ := json.Marshal(m.e.MetaInfo())
	return string(b)
}
