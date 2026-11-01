package main

import (
	"context"
	"log"
	"net/http"
	"regexp"
	"runtime"
	"sync/atomic"
	"time"
)

// Load guard (from tipitaka.app, where crawlers asking for thousands of server rendered pages on the shared 1 CPU
// droplet piled up renders until nginx timed out and memory went into swap, 2026-10-19). arutha.lk has ~300k word
// pages and ~12k book pages for crawlers. So:
//   - at most ssrSlots renders at once; a request that gets no slot within ssrWait is shed: a person gets the app
//     shell at once (the app renders in the browser), a crawler 503 + Retry-After (search engines slow down, keep the
//     page);
//   - the expensive api ops (full text search) have their own slots, busy: 503 busy;
//   - counters for /api/health and a log line every 10 minutes.

const (
	ssrSlots  = 2 // one CPU shared with tipitaka.app and tipitaka.lk: a word page is a few indexed reads
	ssrWait   = 1500 * time.Millisecond
	apiSlots  = 2
	apiWait   = 5 * time.Second
	retryBots = "120"
)

// heavy api ops (the others are a few indexed sqlite reads)
var heavyOps = map[string]bool{"search": true}

var botRe = regexp.MustCompile(`(?i)bot\b|bot/|crawl|spider|slurp|facebookexternalhit|bingpreview|mediapartners|ia_archiver|` +
	`python-requests|python-urllib|aiohttp|scrapy|httpclient|go-http-client|okhttp|wget|curl|libwww|java/|headless|` +
	`petalbot|bytespider|gptbot|claudebot|ccbot|amazonbot|perplexity|yandex|baidu|semrush|ahrefs|mj12|dotbot|dataforseo|` +
	`seznam|sogou|applebot|duckduck|qwant|imagesift|meta-externalagent|timpibot|diffbot`)

func isBot(r *http.Request) bool {
	ua := r.UserAgent()
	return ua == "" || botRe.MatchString(ua)
}

type slots struct{ ch chan struct{} }

func newSlots(n int) *slots { return &slots{ch: make(chan struct{}, n)} }

// acquire waits up to wait for a slot (false: none, or the request went away)
func (s *slots) acquire(ctx context.Context, wait time.Duration) bool {
	select {
	case s.ch <- struct{}{}:
		return true
	default:
	}
	t := time.NewTimer(wait)
	defer t.Stop()
	select {
	case s.ch <- struct{}{}:
		return true
	case <-t.C:
		return false
	case <-ctx.Done():
		return false
	}
}
func (s *slots) release()   { <-s.ch }
func (s *slots) inUse() int { return len(s.ch) }

type guardStats struct {
	renders, cacheHits, shedPeople, shedBots, apiBusy, botRequests atomic.Int64
}

type guard struct {
	ssr, api *slots
	stats    guardStats
	started  time.Time
}

func newGuard() *guard {
	return &guard{ssr: newSlots(ssrSlots), api: newSlots(apiSlots), started: time.Now()}
}

// snapshot for /api/health
func (g *guard) snapshot() map[string]any {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return map[string]any{
		"uptime": time.Since(g.started).Round(time.Second).String(), "rendering": g.ssr.inUse(), "searching": g.api.inUse(),
		"renders": g.stats.renders.Load(), "cacheHits": g.stats.cacheHits.Load(), "shedPeople": g.stats.shedPeople.Load(),
		"shedBots": g.stats.shedBots.Load(), "apiBusy": g.stats.apiBusy.Load(), "botRequests": g.stats.botRequests.Load(),
		"heapMB": m.HeapAlloc >> 20, "sysMB": m.Sys >> 20, "goroutines": runtime.NumGoroutine(),
	}
}

// logEvery writes the counters of the last period (journalctl -u arutha_lk)
func (g *guard) logEvery(d time.Duration) {
	var last [6]int64
	for range time.Tick(d) {
		cur := [6]int64{g.stats.renders.Load(), g.stats.cacheHits.Load(), g.stats.shedPeople.Load(), g.stats.shedBots.Load(),
			g.stats.apiBusy.Load(), g.stats.botRequests.Load()}
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		log.Printf("load %v: renders %d, cache hits %d, shed people %d, shed bots %d, api busy %d, bot requests %d; heap %d MB",
			d, cur[0]-last[0], cur[1]-last[1], cur[2]-last[2], cur[3]-last[3], cur[4]-last[4], cur[5]-last[5], m.HeapAlloc>>20)
		last = cur
	}
}
