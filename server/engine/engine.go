// Package engine is the data layer of arutha.lk: suggestions, search, word pages and the dictionary pages over
// db/dict.db (built by build/dict.ts). It is used by the web server (server/) and compiled with gomobile for the
// Android / iOS apps (server/mobile), so that every platform runs the same code next to the database and only
// small results cross the network or the JS bridge.
//
// All operations take string parameters (url query or a JSON object) and return JSON-serialisable values, see
// Call. The database is opened read-only. dict.go, normalize.go and lru.go are shared with tipitaka.app
// (scripts/check-sync.sh).
package engine

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

// Engine holds the open database and the dictionary list.
type Engine struct {
	dict  *sql.DB
	Meta  map[string]string
	infos []DictInfo
	byID  map[int]*DictInfo
	cache *lru // ranked search hits for paging
}

var (
	ErrNotFound = errors.New("not found")
	ErrNoDict   = errors.New("dictionary database not available")
)

// ParamError is a bad request parameter.
type ParamError struct{ Msg string }

func (e *ParamError) Error() string { return e.Msg }

// openRO opens an sqlite file strictly read-only (the "file:" prefix is required for the query parameters).
func openRO(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}
	abs, _ := filepath.Abs(path)
	dsn := "file:" + (&url.URL{Path: abs}).EscapedPath() + "?mode=ro&immutable=1&_query_only=1&cache=private"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(8)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return db, nil
}

// Open opens dict.db.
func Open(dictPath string) (*Engine, error) {
	db, err := openRO(dictPath)
	if err != nil {
		return nil, err
	}
	e := &Engine{dict: db, cache: newLRU(64)}
	if err := e.load(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return e, nil
}

func (e *Engine) Close() { e.dict.Close() }

func (e *Engine) load(ctx context.Context) error {
	e.Meta = map[string]string{}
	rows, err := e.dict.QueryContext(ctx, "SELECT k, v FROM meta")
	if err != nil {
		return err
	}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			rows.Close()
			return err
		}
		e.Meta[k] = v
	}
	rows.Close()
	ds, err := e.Dicts(ctx)
	if err != nil {
		return err
	}
	extra := map[int][2]string{}
	rows, err = e.dict.QueryContext(ctx, "SELECT id, src, v1 FROM dict")
	if err != nil {
		return err
	}
	for rows.Next() {
		var id int
		var src, v1 string
		if err := rows.Scan(&id, &src, &v1); err != nil {
			rows.Close()
			return err
		}
		extra[id] = [2]string{src, v1}
	}
	rows.Close()
	e.byID = map[int]*DictInfo{}
	for _, d := range ds {
		e.infos = append(e.infos, DictInfo{Dict: d, Src: extra[d.ID][0], V1: extra[d.ID][1]})
	}
	for i := range e.infos {
		e.byID[e.infos[i].ID] = &e.infos[i]
	}
	return rows.Err()
}

// DictInfo is a dictionary with the language of its headwords (si, pi, en) and its v1 id.
type DictInfo struct {
	Dict
	Src string `json:"src"`
	V1  string `json:"v1,omitempty"`
}

// DictInfos lists the dictionaries in their default order.
func (e *Engine) DictInfos() []DictInfo { return e.infos }

// DictByCode finds a dictionary by its code or its v1 id (old urls).
func (e *Engine) DictByCode(code string) *DictInfo {
	for i := range e.infos {
		if e.infos[i].Code == code || (e.infos[i].V1 != "" && e.infos[i].V1 == code) {
			return &e.infos[i]
		}
	}
	return nil
}
