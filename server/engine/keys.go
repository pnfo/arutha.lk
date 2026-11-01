package engine

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// The lookup keys and index tokens of shared/normalize.ts (golden vectors: shared/normalize.golden.json).

var invisible = strings.NewReplacer("\u200b", "", "\u200c", "", "\u200d", "", "\u00ad", "", "\ufeff", "", "\u2060", "")

// Key is the lookup key of a headword or a query: NFC, lower case, folded Roman, without joiners (ක්‍රි = ක්රි),
// single spaces (shared/normalize.ts key).
func Key(s string) string {
	return strings.Join(strings.Fields(norm.NFC.String(Fold(invisible.Replace(s)))), " ")
}

var (
	tagRe    = regexp.MustCompile(`<[^>]*>`)
	entityRe = regexp.MustCompile(`&[a-z]+;|&#\d+;`)
)

// FtsTokens are the words of a text (html allowed) as full text index tokens (shared/normalize.ts ftsTokens).
func FtsTokens(html string) []string {
	text := entityRe.ReplaceAllString(tagRe.ReplaceAllString(html, ""), " ")
	return strings.FieldsFunc(Key(text), func(r rune) bool {
		return !(unicode.IsLetter(r) || unicode.Is(unicode.M, r) || unicode.IsNumber(r))
	})
}

// ScriptOf is the script of a query: si (has Sinhala letters), ro (Latin letters), other.
func ScriptOf(s string) string {
	for _, r := range s {
		if r >= 0x0d80 && r <= 0x0dff {
			return "si"
		}
	}
	for _, r := range Fold(s) {
		if r >= 'a' && r <= 'z' {
			return "ro"
		}
	}
	return "other"
}

// glob turns the wildcards of a query (% of v1, * ?) into a GLOB pattern (used by dict.go).
func glob(p string) string {
	p = strings.NewReplacer("%", "*", "_", "?", "[", "", "]", "").Replace(p)
	for strings.Contains(p, "**") {
		p = strings.ReplaceAll(p, "**", "*")
	}
	return p
}

// prefixEnd is the upper bound of the keys that start with p (binary order of UTF-8).
func prefixEnd(p string) string { return p + "\U0010FFFF" }
