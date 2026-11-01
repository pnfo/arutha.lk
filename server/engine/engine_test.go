package engine

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// Tests on the fixture db (npm run build:dict:fixture: the words of e2e/fixtures/words.txt).

func testEngine(t *testing.T) *Engine {
	t.Helper()
	e, err := Open("../../e2e/fixtures/db/dict.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(e.Close)
	return e
}

func words(cards []Card) []string {
	var out []string
	for _, c := range cards {
		out = append(out, c.Word)
	}
	return out
}

func find(cards []Card, w string) *Card {
	for i := range cards {
		if cards[i].Word == w {
			return &cards[i]
		}
	}
	return nil
}

func TestKeysGolden(t *testing.T) {
	b, err := os.ReadFile("../../shared/normalize.golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var g struct {
		Key [][2]string `json:"key"`
		Fts []struct {
			In  string   `json:"in"`
			Out []string `json:"out"`
		} `json:"fts"`
	}
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatal(err)
	}
	for _, c := range g.Key {
		if got := Key(c[0]); got != c[1] {
			t.Errorf("Key(%q) = %q, want %q (shared/normalize.ts)", c[0], got, c[1])
		}
	}
	for _, c := range g.Fts {
		if got := strings.Join(FtsTokens(c.In), "|"); got != strings.Join(c.Out, "|") {
			t.Errorf("FtsTokens(%q) = %q, want %q", c.In, got, strings.Join(c.Out, "|"))
		}
	}
}

func TestSearchTiers(t *testing.T) {
	e := testEngine(t)
	ctx := context.Background()
	cases := []struct {
		q, word string
		tier    int
	}{
		{"ධර්මය", "ධර්මය", TierExact},
		{"ධම්මස්ස", "ධම්ම", TierInflection},   // Sinhala script Pali -> dhammassa -> dhamma
		{"dhammassa", "ධම්ම", TierInflection}, // Roman
		{"buddhassa", "බුද්ධ", TierInflection},
		{"love", "love", TierExact},
		{"akuru", "අකුරු", TierSinglish},
		{"ගසට", "ගස", TierStem},
		{"a.d.", "a.d.", TierExact},
		{"ක්රියාව", "ක්‍රියාව", TierExact}, // without the ZWJ of the rakaransaya
	}
	for _, c := range cases {
		r, err := e.Search(ctx, c.q, nil, 0, 20)
		if err != nil {
			t.Fatal(c.q, err)
		}
		got := find(r.Cards, c.word)
		if got == nil {
			t.Errorf("%s: %s not found in %v", c.q, c.word, words(r.Cards))
			continue
		}
		if got.Tier != c.tier {
			t.Errorf("%s: %s tier %d, want %d", c.q, c.word, got.Tier, c.tier)
		}
	}
	// Pali typed with the Sinhala long vowel: ධම්මස්සේ is not a form, but ධම්මෙ (dhamme) is, as ධම්මේ
	if r, err := e.Search(ctx, "ධම්මේ", nil, 0, 20); err != nil || find(r.Cards, "ධම්ම") == nil {
		t.Errorf("ධම්මේ: ධම්ම not found: %v", err)
	}
	// DPD analysis of the typed form
	r, _ := e.Search(ctx, "buddhassa", nil, 0, 20)
	if r.Analysis == nil || !strings.Contains(string(r.Analysis.Grammar), "dat sg") {
		t.Errorf("buddhassa: no DPD analysis: %+v", r.Analysis)
	}
	c := find(r.Cards, "බුද්ධ")
	if c == nil || len(c.Dpd) == 0 || len(c.Entries) == 0 {
		t.Errorf("buddhassa: බුද්ධ should have DPD and the Sinhala dictionaries: %+v", c)
	}
}

func TestSearchMeanings(t *testing.T) {
	e := testEngine(t)
	// "අම්මා": the words whose meanings have it (reverse lookup), after the headword itself
	r, err := e.Search(context.Background(), "අම්මා", nil, 0, 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Cards) == 0 || r.Cards[0].Word != "අම්මා" {
		t.Fatalf("අම්මා first: %v", words(r.Cards))
	}
	var meaning bool
	for _, c := range r.Cards {
		if c.Tier == TierMeaning {
			meaning = true
		}
	}
	if !meaning {
		t.Errorf("අම්මා: no meaning matches in %v", words(r.Cards))
	}
	// exact: no prefixes or meanings
	r, _ = e.Search(context.Background(), "love.", nil, 0, 50)
	if len(r.Cards) != 1 || r.Cards[0].Word != "love" {
		t.Errorf("love.: %v", words(r.Cards))
	}
}

func TestWildcards(t *testing.T) {
	e := testEngine(t)
	// * (as tipitaka.app) and % (v1) are the same; Singlish and Sinhala mixed
	for _, q := range []string{"aa*වාදය", "aa%වාදය", "*වාදය", "ආ*"} {
		r, err := e.Search(context.Background(), q, nil, 0, 50)
		if err != nil {
			t.Fatal(q, err)
		}
		if find(r.Cards, "ආස්වාදය") == nil {
			t.Errorf("%s: ආස්වාදය not in %v", q, words(r.Cards))
		}
	}
}

func TestDictPageAbout(t *testing.T) {
	e := testEngine(t)
	d, err := e.DictPage(context.Background(), "si-buddhadatta")
	if err != nil || !strings.Contains(d.About, "මුඛබන්ධය") || !strings.Contains(d.About, "1 මැයි 1950") {
		t.Errorf("si-buddhadatta about: %v %.100s", err, d.About)
	}
	p, _ := e.DictPage(context.Background(), "pali")
	if !strings.Contains(p.About, "පුණ්‍යානුමෝදනා") {
		t.Errorf("pali about: %.100s", p.About)
	}
}

func TestSearchPaging(t *testing.T) {
	e := testEngine(t)
	ctx := context.Background()
	all, err := e.Search(ctx, "lo", nil, 0, 50)
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	var paged []string
	for p := 0; ; p++ {
		r, err := e.Search(ctx, "lo", nil, p, 2)
		if err != nil {
			t.Fatal(err)
		}
		for _, c := range r.Cards {
			if seen[c.Word] {
				t.Errorf("page %d repeats %s", p, c.Word)
			}
			seen[c.Word] = true
			paged = append(paged, c.Word)
		}
		if !r.More {
			break
		}
	}
	if strings.Join(paged, ",") != strings.Join(words(all.Cards), ",") {
		t.Errorf("paged %v != %v", paged, words(all.Cards))
	}
}

func TestDictFilter(t *testing.T) {
	e := testEngine(t)
	r, err := e.Search(context.Background(), "love", []string{"sankshiptha"}, 0, 50)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range r.Cards {
		for _, en := range c.Entries {
			if en.Dict != "sankshiptha" {
				t.Errorf("%s: entry of %s with the filter sankshiptha", c.Word, en.Dict)
			}
		}
	}
}

func TestSuggest(t *testing.T) {
	e := testEngine(t)
	ctx := context.Background()
	for q, want := range map[string]string{"lo": "love", "අ": "අ", "dh": "ධම්ම", "akuru": "අකුරු", "ධම්": "ධම්ම"} {
		s, err := e.Suggest(ctx, q, nil, 10)
		if err != nil {
			t.Fatal(err)
		}
		var ws []string
		for _, w := range s {
			ws = append(ws, w.Word)
		}
		if !contains(ws, want) {
			t.Errorf("suggest %s: %s not in %v", q, want, ws)
		}
	}
	if s, _ := e.Suggest(ctx, "", nil, 10); len(s) != 0 {
		t.Errorf("empty query: %v", s)
	}
}

func TestWord(t *testing.T) {
	e := testEngine(t)
	ctx := context.Background()
	p, err := e.Word(ctx, "ධම්ම", nil)
	if err != nil {
		t.Fatal(err)
	}
	if p.Roman != "dhamma" || len(p.Dpd) == 0 || len(p.Entries) == 0 || len(p.Pages) == 0 {
		t.Errorf("ධම්ම: roman %q, %d dpd, %d entries, pages %v", p.Roman, len(p.Dpd), len(p.Entries), p.Pages)
	}
	if !strings.Contains(p.Src, "pi") {
		t.Errorf("ධම්ම src %q", p.Src)
	}
	// another form finds the canonical headword: the server redirects
	for _, w := range []string{"LOVE", "ක්රියාව"} {
		p, err := e.Word(ctx, w, nil)
		if err != nil {
			t.Fatal(w, err)
		}
		if p.Word == w {
			t.Errorf("%s: canonical form expected, got %s", w, p.Word)
		}
	}
	if _, err := e.Word(ctx, "no-such-word-xyz", nil); err != ErrNotFound {
		t.Errorf("missing word: %v", err)
	}
	// a variant headword shows its entry: අඞ්ක is a variant of අංක in sankshiptha
	p, err = e.Word(ctx, "අඞ්ක", nil)
	if err != nil || len(p.Entries) == 0 {
		t.Errorf("variant අඞ්ක: %v %+v", err, p)
	}
}

func TestBrowse(t *testing.T) {
	e := testEngine(t)
	ctx := context.Background()
	// v1 id and new code reach the same page
	a, err := e.Browse(ctx, "akshara_vinyasa", 1)
	if err != nil {
		t.Fatal(err)
	}
	b, err := e.Browse(ctx, "akshara", 1)
	if err != nil {
		t.Fatal(err)
	}
	if a.Pages != b.Pages || a.Pages < 300 || a.V1 != "akshara_vinyasa" {
		t.Errorf("browse: %+v %+v", a.Pages, b.Pages)
	}
	if _, err := e.Browse(ctx, "dpd", 1); err != ErrNotFound {
		t.Errorf("dpd has no book pages: %v", err)
	}
	if _, err := e.Browse(ctx, "sankshiptha", 99999); err != ErrNotFound {
		t.Errorf("page out of range: %v", err)
	}
}

func TestQueryJSON(t *testing.T) {
	e := testEngine(t)
	var r struct {
		Ok    *SearchResult `json:"ok"`
		Error string        `json:"error"`
	}
	if err := json.Unmarshal([]byte(e.QueryJSON(`{"op":"search","q":"love"}`)), &r); err != nil || r.Ok == nil || len(r.Ok.Cards) == 0 {
		t.Fatalf("search over the bridge: %v %+v", err, r)
	}
	if out := e.QueryJSON(`{"op":"nope"}`); !strings.Contains(out, "not_found") {
		t.Errorf("unknown op: %s", out)
	}
	if out := e.QueryJSON(`{"op":"search","q":"` + strings.Repeat("a", 400) + `"}`); !strings.Contains(out, "bad_request") {
		t.Errorf("long param: %s", out)
	}
}
