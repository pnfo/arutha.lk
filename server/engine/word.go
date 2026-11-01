package engine

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"golang.org/x/text/unicode/norm"
)

// WordPage is the page of a headword (/<word>): every dictionary's entries and DPD.
type WordPage struct {
	Word     string      `json:"word"`
	Src      string      `json:"src"`
	Roman    string      `json:"roman,omitempty"` // Pali headwords: the Roman form
	Entries  []DictEntry `json:"entries"`
	Dpd      []DpdHead   `json:"dpd"`
	Analysis *Analysis   `json:"analysis,omitempty"` // DPD's grammar of the word as an inflected form
	Prev     *WordRef    `json:"prev,omitempty"`
	Next     *WordRef    `json:"next,omitempty"`
	Pages    []BookRef   `json:"pages"` // the book pages (v1 /bookpage) that list the word
	Also     []WordRef   `json:"also"`  // other headwords with the same key (English "a", Pali "අ")
}

// BookRef is a page of a dictionary's book pages.
type BookRef struct {
	Dict string `json:"dict"`
	V1   string `json:"v1"`
	Page int    `json:"page"`
}

// Word finds the headword w (its displayed form, else its key: Roman Pali, another spelling) and its entries.
// The result's Word is the canonical form (the server redirects other forms to it).
func (e *Engine) Word(ctx context.Context, w string, dicts []string) (*WordPage, error) {
	w = norm.NFC.String(strings.TrimSpace(w))
	if w == "" {
		return nil, ErrNotFound
	}
	var id int
	err := e.dict.QueryRowContext(ctx, "SELECT id FROM headword WHERE word = ?", w).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		rs, err2 := e.exactKey(ctx, Key(w))
		if err2 != nil {
			return nil, err2
		}
		if len(rs) == 0 {
			return nil, ErrNotFound
		}
		id = rs[0].id
	} else if err != nil {
		return nil, err
	}
	heads, err := e.headwords(ctx, []int{id, id - 1, id + 1})
	if err != nil {
		return nil, err
	}
	h := heads[id]
	p := &WordPage{Word: h.Word, Src: h.Src, Pages: []BookRef{}, Also: []WordRef{}}
	if pv, ok := heads[id-1]; ok {
		p.Prev = &pv
	}
	if nx, ok := heads[id+1]; ok {
		p.Next = &nx
	}
	cs, err := e.cards(ctx, []hit{{hid: id}}, dicts)
	if err != nil {
		return nil, err
	}
	p.Entries, p.Dpd = cs[0].Entries, cs[0].Dpd
	if strings.Contains(h.Src, "pi") {
		p.Roman = PaliRoman(h.Word)
		if a, _, err := e.dpdForm(ctx, p.Roman); err != nil {
			return nil, err
		} else if a != nil && (len(a.Grammar) > 0 || len(a.Deconstructor) > 0) {
			p.Analysis = a
		}
	}
	// the v1 book pages of the dictionaries that have the word
	for _, d := range h.Dicts {
		di := e.DictByCode(d)
		if di == nil || di.V1 == "" {
			continue
		}
		var page int
		if e.dict.QueryRowContext(ctx, "SELECT page FROM bookpage WHERE dict_id = ? AND first <= ? ORDER BY page DESC LIMIT 1", di.ID, h.Word).Scan(&page) == nil {
			p.Pages = append(p.Pages, BookRef{Dict: di.Code, V1: di.V1, Page: page})
		}
	}
	// other headwords of the same key
	rs, err := e.exactKey(ctx, Key(h.Word))
	if err != nil {
		return nil, err
	}
	var ids []int
	for _, r := range rs {
		if r.id != id {
			ids = append(ids, r.id)
		}
	}
	if p.Roman != "" {
		if rs, err := e.exactKey(ctx, Key(p.Roman)); err == nil {
			for _, r := range rs {
				if r.id != id && !containsInt(ids, r.id) {
					ids = append(ids, r.id)
				}
			}
		}
	}
	if len(ids) > 0 {
		hs, err := e.headwords(ctx, ids)
		if err != nil {
			return nil, err
		}
		for _, i := range ids {
			p.Also = append(p.Also, hs[i])
		}
	}
	return p, nil
}

func containsInt(list []int, n int) bool {
	for _, x := range list {
		if x == n {
			return true
		}
	}
	return false
}

// BookPage is a page of a dictionary as v1 showed it (24 headwords a page, frozen boundaries: data/bookpages.tsv).
type BookPage struct {
	Dict  string     `json:"dict"`
	V1    string     `json:"v1"`
	Name  string     `json:"name"`
	Page  int        `json:"page"`
	Pages int        `json:"pages"`
	Words []BookWord `json:"words"`
}

// BookWord is a headword of a book page with its entries in that dictionary.
type BookWord struct {
	Word    string      `json:"word"`
	Entries []DictEntry `json:"entries"`
}

// Browse returns a book page of a dictionary (code or v1 id).
func (e *Engine) Browse(ctx context.Context, dict string, page int) (*BookPage, error) {
	d := e.DictByCode(dict)
	if d == nil || d.V1 == "" {
		return nil, ErrNotFound
	}
	res := &BookPage{Dict: d.Code, V1: d.V1, Name: d.Name, Page: page, Words: []BookWord{}}
	if err := e.dict.QueryRowContext(ctx, "SELECT max(page) FROM bookpage WHERE dict_id = ?", d.ID).Scan(&res.Pages); err != nil {
		return nil, err
	}
	var first, next string
	if err := e.dict.QueryRowContext(ctx, "SELECT first FROM bookpage WHERE dict_id = ? AND page = ?", d.ID, page).Scan(&first); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	_ = e.dict.QueryRowContext(ctx, "SELECT first FROM bookpage WHERE dict_id = ? AND page = ?", d.ID, page+1).Scan(&next)
	q := `SELECT h.word, e.id, e.word, e.hom, e.meaning FROM headword h JOIN entry e ON e.hid = h.id
		WHERE e.dict_id = ? AND e.alias_of IS NULL AND h.word >= ?`
	args := []any{d.ID, first}
	if next != "" {
		q += " AND h.word < ?"
		args = append(args, next)
	}
	rows, err := e.dict.QueryContext(ctx, q+" ORDER BY h.word, e.id LIMIT 200", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var hw string
		var de DictEntry
		if err := rows.Scan(&hw, &de.id, &de.Word, &de.Hom, &de.Meaning); err != nil {
			return nil, err
		}
		de.Dict = d.Code
		if n := len(res.Words); n > 0 && res.Words[n-1].Word == hw {
			res.Words[n-1].Entries = append(res.Words[n-1].Entries, de)
		} else {
			res.Words = append(res.Words, BookWord{Word: hw, Entries: []DictEntry{de}})
		}
	}
	return res, rows.Err()
}

// DictLanding is the page of a dictionary (/dict/<code>): its description, an A-Z index into its book pages and its
// most common words. The code "pali" is the Pali dictionaries together.
type DictLanding struct {
	Code    string     `json:"code"`
	About   string     `json:"about,omitempty"` // html (data/about/<code>.html)
	Dicts   []DictInfo `json:"dicts"`
	Letters []Letter   `json:"letters"`
	Words   []WordRef  `json:"words"`
}

// Letter is the first book page of the words that begin with a letter.
type Letter struct {
	Letter string `json:"letter"`
	Dict   string `json:"dict"`
	V1     string `json:"v1"`
	Page   int    `json:"page"`
}

// PaliDicts are the dictionaries of /dict/pali.
var PaliDicts = []string{"si-buddhadatta", "si-sumangala", "dpd"}

func (e *Engine) DictPage(ctx context.Context, code string) (*DictLanding, error) {
	codes := []string{code}
	if code == "pali" {
		codes = PaliDicts
	}
	res := &DictLanding{Code: code, About: e.Meta["about:"+code], Dicts: []DictInfo{}, Letters: []Letter{}, Words: []WordRef{}}
	var where []string
	var args []any
	for _, c := range codes {
		d := e.DictByCode(c)
		if d == nil {
			return nil, ErrNotFound
		}
		res.Dicts = append(res.Dicts, *d)
		where = append(where, "(',' || dicts || ',') LIKE ?")
		args = append(args, "%,"+d.Code+",%")
	}
	// the A-Z index of the first dictionary that has book pages
	for _, d := range res.Dicts {
		if d.V1 == "" {
			continue
		}
		rows, err := e.dict.QueryContext(ctx, "SELECT page, first FROM bookpage WHERE dict_id = ? ORDER BY page", d.ID)
		if err != nil {
			return nil, err
		}
		last := ""
		for rows.Next() {
			var page int
			var first string
			if err := rows.Scan(&page, &first); err != nil {
				rows.Close()
				return nil, err
			}
			if l := firstLetter(first); l != last {
				res.Letters = append(res.Letters, Letter{Letter: l, Dict: d.Code, V1: d.V1, Page: page})
				last = l
			}
		}
		rows.Close()
		break
	}
	rows, err := e.dict.QueryContext(ctx, "SELECT word, src, dicts FROM headword WHERE "+strings.Join(where, " OR ")+" ORDER BY score DESC LIMIT 60", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var w WordRef
		var dicts string
		if err := rows.Scan(&w.Word, &w.Src, &dicts); err != nil {
			return nil, err
		}
		w.Dicts = strings.Split(dicts, ",")
		res.Words = append(res.Words, w)
	}
	return res, rows.Err()
}

// firstLetter: the first letter of a word with its vowel sign, so that the index has ක, කා, කි ... (Sinhala) or a-z.
func firstLetter(w string) string {
	rs := []rune(w)
	if len(rs) == 0 {
		return ""
	}
	if rs[0] >= 0x0d80 && rs[0] <= 0x0dff {
		return string(rs[0])
	}
	return strings.ToLower(string(rs[0]))
}
