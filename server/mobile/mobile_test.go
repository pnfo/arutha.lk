package mobile

import (
	"strings"
	"testing"
)

func TestQuery(t *testing.T) {
	m, err := Open("../../e2e/fixtures/db/dict.db")
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()
	if out := m.Query(`{"op":"word","w":"love"}`); !strings.HasPrefix(out, `{"ok":{"word":"love"`) {
		t.Errorf("word: %.200s", out)
	}
	if m.Version() == "" || !strings.Contains(m.Meta(), "contentHash") {
		t.Errorf("version %q meta %s", m.Version(), m.Meta())
	}
}
