package engine

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// Tests on the full db/dict.db (FULL=1 go test ./engine -run Full -v): the Pali conversion of every headword
// and a look at the ranking of typical queries.
func fullEngine(t *testing.T) *Engine {
	if os.Getenv("FULL") == "" {
		t.Skip("FULL=1 for the tests on db/dict.db")
	}
	e, err := Open("../../db/dict.db")
	if err != nil {
		t.Fatal(err)
	}
	return e
}

func TestFullPaliRoman(t *testing.T) {
	e := fullEngine(t)
	rows, err := e.dict.Query(`SELECT e.word, h.word FROM entry e JOIN headword h ON h.id = e.hid JOIN dict d ON d.id = e.dict_id
		WHERE d.src = 'pi' AND e.alias_of IS NULL`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	bad, n := 0, 0
	for rows.Next() {
		var ro, si string
		rows.Scan(&ro, &si)
		n++
		if got := PaliRoman(si); got != ro {
			if bad++; bad <= 10 {
				t.Logf("%s -> %s, want %s", si, got, ro)
			}
		}
	}
	t.Logf("%d of %d Sinhala Pali headwords convert to another Roman form", bad, n)
	if bad*100 > n {
		t.Errorf("too many: %d", bad)
	}
}

func TestFullSearch(t *testing.T) {
	e := fullEngine(t)
	ctx := context.Background()
	for _, q := range []string{"dhammassa", "ධම්මස්ස", "buddhassa", "love", "ආදරය", "අම්මා", "ගසට", "dh", "akuru", "aa%වාදය", "dhammacakkappavattana", "a.d."} {
		r, err := e.Search(ctx, q, nil, 0, 8)
		if err != nil {
			t.Fatal(q, err)
		}
		var cs []string
		for _, c := range r.Cards {
			cs = append(cs, c.Word+"/"+string(rune('0'+c.Tier))+"/"+strings.Join(dictsOf(c), "+"))
		}
		a := ""
		if r.Analysis != nil {
			b, _ := json.Marshal(r.Analysis.Grammar)
			a = string(b)
			if len(a) > 80 {
				a = a[:80]
			}
		}
		t.Logf("%-22s total %4d  %s  %s", q, r.Total, strings.Join(cs, "  "), a)
	}
	for _, q := range []string{"a", "dh", "lo", "අ", "dhamma", "budu"} {
		s, err := e.Suggest(ctx, q, nil, 8)
		if err != nil {
			t.Fatal(err)
		}
		var ws []string
		for _, w := range s {
			ws = append(ws, w.Word)
		}
		t.Logf("suggest %-8s %s", q, strings.Join(ws, ", "))
	}
}

func dictsOf(c Card) []string {
	var out []string
	for _, e := range c.Entries {
		if !contains(out, e.Dict) {
			out = append(out, e.Dict)
		}
	}
	if len(c.Dpd) > 0 {
		out = append(out, "dpd")
	}
	return out
}
