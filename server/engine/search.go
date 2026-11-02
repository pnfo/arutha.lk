package engine

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"unicode/utf8"

	singlish "github.com/pnfo/singlish-search"
	"github.com/pnfo/singlish-search/roman"
	"golang.org/x/text/unicode/norm"
)

// WordRef is a headword in a list (suggestions, neighbours).
type WordRef struct {
	Word  string   `json:"word"`
	Src   string   `json:"src"`
	Dicts []string `json:"dicts"`
}

// Card is a headword of the search results with its entries.
type Card struct {
	Word    string      `json:"word"`
	Src     string      `json:"src"`
	Tier    int         `json:"tier"`
	Via     string      `json:"via,omitempty"` // the inflected form, Singlish spelling or word of the meaning that matched
	Entries []DictEntry `json:"entries"`
	Dpd     []DpdHead   `json:"dpd"`
}

// Analysis is DPD's analysis of a typed Pali form.
type Analysis struct {
	Word          string          `json:"word"`
	Grammar       json.RawMessage `json:"grammar,omitempty"`       // [[lemma, pos, grammar], ...]
	Deconstructor json.RawMessage `json:"deconstructor,omitempty"` // ["a + b", ...]
}

// SearchResult is one page of the ranked headwords of a query.
type SearchResult struct {
	Query    string    `json:"query"`
	Exact    bool      `json:"exact"`
	Cards    []Card    `json:"cards"`
	Total    int       `json:"total"`
	Page     int       `json:"page"`
	More     bool      `json:"more"`
	Analysis *Analysis `json:"analysis,omitempty"`
	Singlish []string  `json:"singlish,omitempty"` // the Sinhala spellings tried for a Singlish query
}

// The tiers of the search results, best first.
const (
	TierExact      = 0 // the headword (any script, Pali in Roman, English)
	TierInflection = 1 // a DPD inflected form or compound part -> its headword
	TierSinglish   = 2 // a Sinhala spelling of the Singlish query
	TierPrefix     = 3 // headwords starting with the query (or matching its wildcards)
	TierStem       = 4 // the query without a Sinhala case ending
	TierMeaning    = 5 // the words of the meanings (reverse lookup: English or Sinhala -> Pali, ...)
)

const (
	maxHits       = 3000 // ranked headwords kept for paging
	maxCandidates = 12   // Singlish spellings tried
)

type hit struct {
	hid   int
	tier  int
	via   string
	dicts string
}

type query struct {
	raw   string   // NFC, lower case, without the final dots
	full  string   // key of the input with its dots (English "a.d.")
	key   string   // key of raw with GLOB wildcards
	exact bool     // ended with "." : headwords only, no prefixes or meanings
	wild  bool     // has % * ?
	cands []string // keys of the Singlish spellings, most likely first
	roman []string // Roman forms to look up in DPD
}

func parseQuery(q string) query {
	in := strings.ToLower(norm.NFC.String(strings.TrimSpace(q)))
	x := query{full: Key(in), exact: strings.HasSuffix(in, ".")}
	x.raw = strings.TrimRight(in, ". ")
	x.wild = strings.ContainsAny(x.raw, "%*?")
	x.key = glob(Key(x.raw))
	if x.raw == "" {
		return x
	}
	if singlish.IsSinglishQuery(x.raw) && utf8.RuneCountInString(x.raw) <= 30 {
		for _, c := range singlish.GetPossibleMatchesN(x.raw, maxCandidates) {
			if k := glob(Key(c)); k != x.key && !contains(x.cands, k) {
				x.cands = append(x.cands, k)
			}
		}
	}
	if !x.wild {
		switch ScriptOf(x.raw) {
		case "si":
			// Pali has no long ේ / ෝ, but Sinhala typing has them (අභිලක්ඛේති for අභිලක්ඛෙති)
			if pv := paliVowels.Replace(x.key); pv != x.key && !contains(x.cands, pv) {
				x.cands = append(x.cands, pv)
			}
			x.roman = []string{PaliRoman(x.raw)}
		case "ro":
			x.roman = []string{x.raw}
			// a Pali form typed without diacritics: its Singlish spellings in Roman (buddhassa, dhammam -> dhammaṃ)
			for i, c := range x.cands {
				if i >= 4 {
					break
				}
				if r := PaliRoman(c); !contains(x.roman, r) {
					x.roman = append(x.roman, r)
				}
			}
		}
	}
	return x
}

// PaliRoman converts Sinhala script Pali to lower case Roman (IAST, as DPD and the cst headwords; Pali e and o are
// long without a mark: ē ō of the Sinhala ේ ෝ are e o).
func PaliRoman(s string) string {
	return strings.NewReplacer("ē", "e", "ō", "o").Replace(strings.ToLower(norm.NFC.String(roman.FromSinhala(s))))
}

var paliVowels = strings.NewReplacer("ේ", "ෙ", "ෝ", "ො")

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// dictFilter: whether a headword (its dictionaries, comma separated) is shown for the chosen dictionaries.
func dictFilter(dicts []string) func(string) bool {
	if len(dicts) == 0 {
		return func(string) bool { return true }
	}
	return func(hd string) bool {
		for _, d := range strings.Split(hd, ",") {
			if contains(dicts, d) {
				return true
			}
		}
		return false
	}
}

type collector struct {
	hits []hit
	seen map[int]bool
	ok   func(string) bool
}

func (c *collector) add(hid, tier int, via, dicts string) {
	if c.seen[hid] || len(c.hits) >= maxHits || !c.ok(dicts) {
		return
	}
	c.seen[hid] = true
	c.hits = append(c.hits, hit{hid, tier, via, dicts})
}

type hrow struct {
	id    int
	dicts string
	score int
	key   string
	src   string
}

func (e *Engine) headRows(ctx context.Context, q string, args ...any) ([]hrow, error) {
	rows, err := e.dict.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []hrow
	for rows.Next() {
		var r hrow
		if err := rows.Scan(&r.id, &r.dicts, &r.score, &r.key, &r.src); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

const headSel = "SELECT h.id, h.dicts, h.score, k.key, h.src FROM hkey k JOIN headword h ON h.id = k.hid "

func (e *Engine) exactKey(ctx context.Context, k string) ([]hrow, error) {
	return e.headRows(ctx, headSel+"WHERE k.key = ? ORDER BY h.score DESC LIMIT 50", k)
}

// prefixKey: the headwords whose key starts with k, shortest then most common first.
func (e *Engine) prefixKey(ctx context.Context, k string, limit int) ([]hrow, error) {
	return e.headRows(ctx, headSel+"WHERE k.key >= ? AND k.key < ? ORDER BY length(k.key), h.score DESC LIMIT ?", k, prefixEnd(k), limit)
}

func (e *Engine) globKey(ctx context.Context, pat string, limit int) ([]hrow, error) {
	return e.headRows(ctx, headSel+"WHERE k.key GLOB ? ORDER BY length(k.key), h.score DESC LIMIT ?", pat, limit)
}

// rank finds the headwords of a query in tier order (cached for paging).
func (e *Engine) rank(ctx context.Context, x query, dicts []string) ([]hit, *Analysis, error) {
	ck := "rank|" + x.full + "|" + strings.Join(dicts, ",")
	if v, ok := e.cache.get(ck); ok {
		r := v.(rankResult)
		return r.hits, r.analysis, nil
	}
	c := &collector{seen: map[int]bool{}, ok: dictFilter(dicts)}
	var analysis *Analysis
	if x.raw == "" {
		return nil, nil, nil
	}
	if x.wild {
		for _, k := range append([]string{x.key}, x.cands...) {
			rs, err := e.globKey(ctx, k, maxHits)
			if err != nil {
				return nil, nil, err
			}
			for _, r := range rs {
				c.add(r.id, TierPrefix, "", r.dicts)
			}
		}
		e.cache.put(ck, rankResult{c.hits, nil})
		return c.hits, nil, nil
	}
	// 0. the headword itself
	for _, k := range []string{x.full, x.key} {
		rs, err := e.exactKey(ctx, k)
		if err != nil {
			return nil, nil, err
		}
		for _, r := range rs {
			c.add(r.id, TierExact, "", r.dicts)
		}
	}
	// 1. DPD: an inflected form -> its headwords (and the Sinhala Pali dictionaries' entries of them)
	for _, form := range x.roman {
		a, ids, err := e.dpdForm(ctx, form)
		if err != nil {
			return nil, nil, err
		}
		if a == nil {
			continue
		}
		if analysis == nil {
			analysis = a
		}
		rs, err := e.dpdHeadwords(ctx, ids)
		if err != nil {
			return nil, nil, err
		}
		for _, r := range rs {
			c.add(r.id, TierInflection, form, r.dicts)
		}
	}
	// 2. the Sinhala spellings of a Singlish query
	for _, k := range x.cands {
		rs, err := e.exactKey(ctx, k)
		if err != nil {
			return nil, nil, err
		}
		for _, r := range rs {
			c.add(r.id, TierSinglish, k, r.dicts)
		}
	}
	if !x.exact {
		// 3. prefixes (a Singlish spelling may end in a virama that the next letter replaces: dh -> ධ්)
		for i, k := range append([]string{x.key}, x.cands...) {
			k = strings.TrimSuffix(k, "්")
			if k == "" || (i > 4 && len(c.hits) > 200) {
				continue
			}
			rs, err := e.prefixKey(ctx, k, 500)
			if err != nil {
				return nil, nil, err
			}
			for _, r := range rs {
				c.add(r.id, TierPrefix, "", r.dicts)
			}
		}
	}
	// 4. a Sinhala word with a case ending
	if len(c.hits) == 0 && ScriptOf(x.raw) == "si" {
		for _, stem := range sinhalaStems(x.key) {
			rs, err := e.exactKey(ctx, stem)
			if err != nil {
				return nil, nil, err
			}
			for _, r := range rs {
				c.add(r.id, TierStem, stem, r.dicts)
			}
		}
	}
	// 5. the words of the meanings
	if !x.exact {
		texts := []string{x.raw}
		if len(c.hits) == 0 && len(x.cands) > 0 {
			texts = append(texts, x.cands[0])
		}
		for _, t := range texts {
			if err := e.meaningHits(ctx, t, c); err != nil {
				return nil, nil, err
			}
		}
	}
	e.cache.put(ck, rankResult{c.hits, analysis})
	return c.hits, analysis, nil
}

type rankResult struct {
	hits     []hit
	analysis *Analysis
}

// dpdForm looks up a Roman form in DPD's inflection table: the analysis and the DPD headword ids.
func (e *Engine) dpdForm(ctx context.Context, form string) (*Analysis, []int, error) {
	var headwords, grammar, decon string
	err := e.dict.QueryRowContext(ctx, "SELECT headwords, grammar, deconstructor FROM dpd_lookup WHERE word = ?", form).Scan(&headwords, &grammar, &decon)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil
	} else if err != nil {
		return nil, nil, err
	}
	a := &Analysis{Word: form}
	if grammar != "" {
		a.Grammar = json.RawMessage(grammar)
	}
	if decon != "" {
		a.Deconstructor = json.RawMessage(decon)
	}
	var ids []int
	if headwords != "" {
		_ = json.Unmarshal([]byte(headwords), &ids)
	}
	// a compound: the headwords of the parts of its first deconstruction
	if len(ids) == 0 && decon != "" {
		var alts []string
		if json.Unmarshal([]byte(decon), &alts) == nil && len(alts) > 0 {
			for _, part := range strings.Split(alts[0], "+") {
				if part = strings.TrimSpace(part); part != "" {
					var hw string
					if e.dict.QueryRowContext(ctx, "SELECT headwords FROM dpd_lookup WHERE word = ?", part).Scan(&hw) == nil {
						var pids []int
						if json.Unmarshal([]byte(hw), &pids) == nil && len(pids) > 0 {
							ids = append(ids, pids[0])
						}
					}
				}
			}
		}
	}
	if len(ids) > 60 {
		ids = ids[:60]
	}
	return a, ids, nil
}

// dpdHeadwords: our headwords of DPD head ids, in the order of the ids.
func (e *Engine) dpdHeadwords(ctx context.Context, ids []int) ([]hrow, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	rows, err := e.dict.QueryContext(ctx, "SELECT d.id, h.id, h.dicts, h.score FROM dpd_head d JOIN headword h ON h.id = d.hid WHERE d.id IN ("+placeholders(len(ids))+")", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	byDpd := map[int]hrow{}
	for rows.Next() {
		var did int
		var r hrow
		if err := rows.Scan(&did, &r.id, &r.dicts, &r.score); err != nil {
			return nil, err
		}
		byDpd[did] = r
	}
	var out []hrow
	for _, id := range ids {
		if r, ok := byDpd[id]; ok {
			out = append(out, r)
		}
	}
	return out, rows.Err()
}

// meaningHits adds the headwords whose meanings contain the words of t (prefixes for 3+ letters), shortest
// meanings first: an English or Sinhala word finds the headwords it translates.
func (e *Engine) meaningHits(ctx context.Context, t string, c *collector) error {
	toks := FtsTokens(t)
	if len(toks) == 0 || len(toks) > 6 {
		return nil
	}
	var parts []string
	for _, tok := range toks {
		if utf8.RuneCountInString(tok) >= 3 {
			parts = append(parts, tok+"*")
		} else {
			parts = append(parts, tok)
		}
	}
	rows, err := e.dict.QueryContext(ctx, `SELECT x.hid, x.dicts, x.len FROM (
		SELECT e.hid, h.dicts, length(e.meaning) AS len FROM meaning_fts f JOIN entry e ON e.id = f.docid JOIN headword h ON h.id = e.hid
			WHERE meaning_fts MATCH ?1 AND f.docid < ?2
		UNION ALL
		SELECT d.hid, h.dicts, length(d.meaning) FROM meaning_fts f JOIN dpd_head d ON d.id = f.docid - ?2 JOIN headword h ON h.id = d.hid
			WHERE meaning_fts MATCH ?1 AND f.docid >= ?2
		) x ORDER BY x.len LIMIT 2000`, strings.Join(parts, " "), dpdFtsBase)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var hid, n int
		var dicts string
		if err := rows.Scan(&hid, &dicts, &n); err != nil {
			return err
		}
		c.add(hid, TierMeaning, t, dicts)
	}
	return rows.Err()
}

// dpdFtsBase: docids of DPD meanings in meaning_fts (build/dict.ts DPD_FTS_BASE)
const dpdFtsBase = 100_000_000

// sinhalaStems: the word without a common case ending (පොතේ -> පොත, ගසට -> ගස), most specific first.
func sinhalaStems(k string) []string {
	var out []string
	for _, suf := range []string{"යන්ගේ", "වලින්", "වලට", "යන්ට", "යෙන්", "යින්", "යකට", "යක්", "යාගේ", "යාට", "වල", "යට", "යේ", "ගේ", "ින්", "ෙන්", "ට", "ේ", "ය", "ා"} {
		if strings.HasSuffix(k, suf) && utf8.RuneCountInString(k) > utf8.RuneCountInString(suf)+1 {
			b := strings.TrimSuffix(k, suf)
			for _, s := range []string{b, b + "ය", b + "ව"} {
				if !contains(out, s) && s != k {
					out = append(out, s)
				}
			}
		}
	}
	return out
}

// Search returns a page of the ranked headwords of q with their entries.
func (e *Engine) Search(ctx context.Context, q string, dicts []string, page, pageSize int) (*SearchResult, error) {
	if pageSize <= 0 || pageSize > 50 {
		pageSize = 20
	}
	if page < 0 {
		page = 0
	}
	x := parseQuery(q)
	res := &SearchResult{Query: x.raw, Exact: x.exact, Cards: []Card{}, Page: page}
	for i, k := range x.cands {
		if i < 5 {
			res.Singlish = append(res.Singlish, k)
		}
	}
	hits, analysis, err := e.rank(ctx, x, dicts)
	if err != nil {
		return nil, err
	}
	res.Analysis, res.Total = analysis, len(hits)
	from, to := page*pageSize, (page+1)*pageSize
	if from >= len(hits) {
		return res, nil
	}
	if to > len(hits) {
		to = len(hits)
	}
	res.More = to < len(hits)
	cards, err := e.cards(ctx, hits[from:to], dicts)
	if err != nil {
		return nil, err
	}
	res.Cards = cards
	return res, nil
}

// cards fills the entries and DPD headwords of the hits.
func (e *Engine) cards(ctx context.Context, hits []hit, dicts []string) ([]Card, error) {
	if len(hits) == 0 {
		return []Card{}, nil
	}
	ids := make([]int, len(hits))
	for i, h := range hits {
		ids[i] = h.hid
	}
	heads, err := e.headwords(ctx, ids)
	if err != nil {
		return nil, err
	}
	entries, err := e.entriesOf(ctx, ids, dicts)
	if err != nil {
		return nil, err
	}
	dpd := map[int][]DpdHead{}
	if hasDpd(dicts) {
		args := make([]any, len(ids))
		for i, id := range ids {
			args[i] = id
		}
		hs, err := e.dpdHeads(ctx, "hid IN ("+placeholders(len(ids))+")", args, 500)
		if err != nil {
			return nil, err
		}
		if err := e.attachDpdHid(ctx, hs, dpd); err != nil {
			return nil, err
		}
	}
	out := make([]Card, 0, len(hits))
	for _, h := range hits {
		hw := heads[h.hid]
		c := Card{Word: hw.Word, Src: hw.Src, Tier: h.tier, Via: h.via, Entries: entries[h.hid], Dpd: dpd[h.hid]}
		if c.Entries == nil {
			c.Entries = []DictEntry{}
		}
		if c.Dpd == nil {
			c.Dpd = []DpdHead{}
		}
		out = append(out, c)
	}
	return out, nil
}

// attachDpdHid groups DPD heads by our headword id.
func (e *Engine) attachDpdHid(ctx context.Context, hs []DpdHead, out map[int][]DpdHead) error {
	if len(hs) == 0 {
		return nil
	}
	args := make([]any, len(hs))
	for i, h := range hs {
		args[i] = h.ID
	}
	rows, err := e.dict.QueryContext(ctx, "SELECT id, hid FROM dpd_head WHERE id IN ("+placeholders(len(hs))+")", args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	hid := map[int]int{}
	for rows.Next() {
		var id, h int
		if err := rows.Scan(&id, &h); err != nil {
			return err
		}
		hid[id] = h
	}
	for _, h := range hs {
		out[hid[h.ID]] = append(out[hid[h.ID]], h)
	}
	return rows.Err()
}

// headwords reads the headwords of ids.
func (e *Engine) headwords(ctx context.Context, ids []int) (map[int]WordRef, error) {
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	rows, err := e.dict.QueryContext(ctx, "SELECT id, word, src, dicts FROM headword WHERE id IN ("+placeholders(len(ids))+")", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]WordRef{}
	for rows.Next() {
		var id int
		var w WordRef
		var dicts string
		if err := rows.Scan(&id, &w.Word, &w.Src, &dicts); err != nil {
			return nil, err
		}
		w.Dicts = strings.Split(dicts, ",")
		out[id] = w
	}
	return out, rows.Err()
}

// entriesOf reads the dictionary entries of headwords (a variant shows the entry it belongs to), in the order of
// the chosen dictionaries (or the default order), then the dictionary's own order.
func (e *Engine) entriesOf(ctx context.Context, ids []int, dicts []string) (map[int][]DictEntry, error) {
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	rows, err := e.dict.QueryContext(ctx, `SELECT e.hid, COALESCE(e.alias_of, e.id), d.code, COALESCE(m.word, e.word), COALESCE(m.hom, e.hom), COALESCE(m.meaning, e.meaning)
		FROM entry e JOIN dict d ON d.id = e.dict_id LEFT JOIN entry m ON m.id = e.alias_of WHERE e.hid IN (`+placeholders(len(ids))+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	order := e.dictOrder(dicts)
	out := map[int][]DictEntry{}
	seen := map[[2]int64]bool{}
	for rows.Next() {
		var hid int
		var de DictEntry
		if err := rows.Scan(&hid, &de.id, &de.Dict, &de.Word, &de.Hom, &de.Meaning); err != nil {
			return nil, err
		}
		if _, ok := order[de.Dict]; !ok || seen[[2]int64{int64(hid), de.id}] {
			continue
		}
		seen[[2]int64{int64(hid), de.id}] = true
		out[hid] = append(out[hid], de)
	}
	for _, es := range out {
		sort.SliceStable(es, func(a, b int) bool {
			if order[es[a].Dict] != order[es[b].Dict] {
				return order[es[a].Dict] < order[es[b].Dict]
			}
			return es[a].id < es[b].id
		})
	}
	return out, rows.Err()
}

// dictOrder: the position of each shown dictionary (the chosen ones in their order, else all).
func (e *Engine) dictOrder(dicts []string) map[string]int {
	order := map[string]int{}
	if len(dicts) == 0 {
		for i, d := range e.infos {
			order[d.Code] = i
		}
		return order
	}
	for i, d := range dicts {
		order[d] = i
	}
	return order
}

// Suggest returns headwords starting with q, for the search box. Exact matches come first, then three lanes take
// turns, each most common first: English words, the Sinhala words of the Singlish spellings, Pali typed in Roman
// (Sinhala input: its Sinhala and Pali words).
func (e *Engine) Suggest(ctx context.Context, q string, dicts []string, limit int) ([]WordRef, error) {
	if limit <= 0 || limit > 20 {
		limit = 10
	}
	x := parseQuery(q)
	out := []WordRef{}
	if x.raw == "" || x.wild {
		return out, nil
	}
	ok := dictFilter(dicts)
	var cands []string
	for _, k := range x.cands {
		// a Singlish spelling may end in a virama that the next letter replaces (dh -> ධ්)
		if k = strings.TrimSuffix(k, "්"); k != "" && k != x.key && !contains(cands, k) && len(cands) < 8 {
			cands = append(cands, k)
		}
	}
	seen := map[int]bool{}
	var exact, en, sing, pi []int
	take := func(rs []hrow, to *[]int, max int) {
		for _, r := range rs {
			if len(*to) >= max {
				return
			}
			if !seen[r.id] && ok(r.dicts) {
				seen[r.id] = true
				*to = append(*to, r.id)
			}
		}
	}
	for _, k := range append([]string{x.key}, cands...) {
		rs, err := e.exactKey(ctx, k)
		if err != nil {
			return nil, err
		}
		take(rs, &exact, limit)
	}
	prefix := func(k, srcCond string) ([]hrow, error) {
		return e.headRows(ctx, headSel+"WHERE k.key > ? AND k.key < ?"+srcCond+" AND NOT "+longSense+" ORDER BY h.score DESC LIMIT ?", k, prefixEnd(k), limit*2)
	}
	enRows, err := prefix(x.key, " AND h.src = 'en'")
	if err != nil {
		return nil, err
	}
	take(enRows, &en, limit)
	piRows, err := prefix(x.key, " AND h.src <> 'en'")
	if err != nil {
		return nil, err
	}
	var srows []hrow
	for _, k := range cands {
		rs, err := prefix(k, "")
		if err != nil {
			return nil, err
		}
		srows = append(srows, rs...)
	}
	sort.SliceStable(srows, func(a, b int) bool { return srows[a].score > srows[b].score })
	take(srows, &sing, limit)
	take(piRows, &pi, limit)
	ids := exact
	for i := 0; len(ids) < limit && (i < len(en) || i < len(sing) || i < len(pi)); i++ {
		for _, lane := range [][]int{en, sing, pi} {
			if i < len(lane) && len(ids) < limit {
				ids = append(ids, lane[i])
			}
		}
	}
	if len(ids) > limit {
		ids = ids[:limit]
	}
	if len(ids) == 0 {
		return out, nil
	}
	heads, err := e.headwords(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, id := range ids {
		out = append(out, heads[id])
	}
	return out, nil
}
