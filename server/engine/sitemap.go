package engine

import "context"

// Sitemap lists. Pali-only headwords (most of them DPD's) are apart from the others so that Search Console reports
// their coverage separately.

const paliOnly = "src = 'pi'"

// longSense: a Sinhala sense of three or more words that only the Sinhala-English dictionary has as a headword (the
// reverse of an English-Sinhala meaning, often a description): its page stays, out of the sitemap and the suggestions.
const longSense = "(dicts = 'sinhala-english' AND word LIKE '% % %')"

// SitemapCounts: the number of headwords in the sitemaps of the words and of the Pali words.
func (e *Engine) SitemapCounts(ctx context.Context) (words, pali int, err error) {
	if err = e.dict.QueryRowContext(ctx, "SELECT count(*) FROM headword WHERE NOT "+paliOnly+" AND NOT "+longSense).Scan(&words); err != nil {
		return
	}
	err = e.dict.QueryRowContext(ctx, "SELECT count(*) FROM headword WHERE "+paliOnly).Scan(&pali)
	return
}

// SitemapWord is a headword and the date its entries last changed.
type SitemapWord struct{ Word, Lastmod string }

// SitemapWords returns a part of the headwords (in id order) of the words or the Pali words.
func (e *Engine) SitemapWords(ctx context.Context, pali bool, offset, limit int) ([]SitemapWord, error) {
	cond := "NOT " + paliOnly + " AND NOT " + longSense
	if pali {
		cond = paliOnly
	}
	rows, err := e.dict.QueryContext(ctx, "SELECT word, lastmod FROM headword WHERE "+cond+" ORDER BY id LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SitemapWord
	for rows.Next() {
		var w SitemapWord
		if err := rows.Scan(&w.Word, &w.Lastmod); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// BookPages lists every v1 book page.
func (e *Engine) BookPages(ctx context.Context) ([]BookRef, error) {
	rows, err := e.dict.QueryContext(ctx, "SELECT d.code, d.v1, b.page FROM bookpage b JOIN dict d ON d.id = b.dict_id ORDER BY d.id, b.page")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BookRef
	for rows.Next() {
		var b BookRef
		if err := rows.Scan(&b.Dict, &b.V1, &b.Page); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
