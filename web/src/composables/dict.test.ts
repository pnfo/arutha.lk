// @vitest-environment jsdom
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanMeaning, reserved, wordPath } from './dict'

describe('word urls', () => {
  it('puts words that are routes under /word/', () => {
    expect(wordPath('about')).toBe('/word/about')
    expect(wordPath('About')).toBe('/word/About')
    expect(wordPath('love')).toBe('/love')
    expect(wordPath('ධම්ම')).toBe('/' + encodeURIComponent('ධම්ම'))
    expect(wordPath('a/b')).toBe('/a%2Fb')
  })
  it('has the routes of the server (server/ssr.go reserved)', () => {
    const go = fs.readFileSync('server/ssr.go', 'utf8') // vitest runs in the repo root
    const block = /var reserved = map\[string\]bool\{([\s\S]*?)\}\n/.exec(go)![1]
    expect([...block.matchAll(/"([^"]+)": true/g)].map(m => m[1]).sort()).toEqual([...reserved].sort())
  })
  it('keeps only the meaning markup', () => {
    expect(cleanMeaning('<a data-dict="x" href="javascript:1" onclick="y">x</a><script>z</script><img src=x>')).toBe('<a data-dict="x">x</a>')
  })
})
