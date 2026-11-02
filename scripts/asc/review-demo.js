// The App Review screen recording (Guideline 2.1): the typical use of the app, played in the debug build on a simulator
// with a dot where it taps. scripts/asc/review-video.sh puts it in the defaults (App.swift: script).
(async () => {
  if (window.__demo) return
  window.__demo = true
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const $ = s => document.querySelector(s)
  async function until(s, ms = 8000) {
    for (let t = 0; t < ms; t += 100) { const e = typeof s === 'function' ? s() : $(s); if (e) return e; await wait(100) }
    throw new Error('demo: no ' + s)
  }
  const dot = document.createElement('div')
  dot.style.cssText = 'position:fixed;z-index:9999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;' +
    'background:rgba(120,120,120,.45);border:2px solid rgba(255,255,255,.9);pointer-events:none;opacity:0;transition:opacity .15s,transform .15s'
  document.body.appendChild(dot)
  async function tap(e) {
    e = typeof e === 'string' ? await until(e) : e
    e.scrollIntoView({ block: 'nearest' })
    const r = e.getBoundingClientRect()
    Object.assign(dot.style, { left: r.left + r.width / 2 + 'px', top: r.top + r.height / 2 + 'px', opacity: 1, transform: 'scale(.8)' })
    await wait(350)
    for (const type of ['mousedown', 'mouseup']) e.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
    e.click()
    dot.style.opacity = 0
    await wait(700)
  }
  async function type(text) {
    const input = await until('input[type=search]')
    await tap(input)
    input.focus()
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    for (const ch of text) {
      input.value += ch
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(260)
    }
    await wait(1200) // the suggestions
  }
  async function scroll(by, ms = 1500) {
    window.scrollBy({ top: by, behavior: 'smooth' })
    await wait(ms)
  }
  // type a word, then tap its suggestion (the first one: any), or search (the enter key)
  async function search(text, label = text) {
    await type(text)
    const opts = [...document.querySelectorAll('#search-menu [role=option]')]
    const opt = label === 'any' ? opts[0] : opts.find(b => b.textContent.trim().startsWith(label))
    if (opt) await tap(opt)
    else { $('input[type=search]').form.requestSubmit(); await wait(700) }
    await until('[data-testid=word-page], [data-testid=search-page]')
  }
  async function menu(link) {
    await tap('[data-testid=menu-button]')
    await wait(500)
    await tap(await until(() => [...document.querySelectorAll('[data-testid=menu] a')].find(a => a.getAttribute('href')?.endsWith(link))))
    await wait(1500)
  }

  await wait(2500) // the home page
  // English → Sinhala
  await search('love')
  await wait(2500)
  await scroll(500, 2000)
  await scroll(-500, 1200)
  await tap('[data-testid=bookmark]')
  await wait(1000)
  // Sinhala typed in Latin letters (Singlish)
  await search('akuru', 'any')
  await wait(2500)
  // a word inside a meaning
  const link = $('main a[data-dict]')
  if (link) { await tap(link); await wait(2500) }
  // an inflected Pali word: its headword and grammar (DPD)
  await search('buddhassa')
  await wait(2500)
  await scroll(600, 2200)
  await scroll(600, 2200)
  window.scrollTo({ top: 0, behavior: 'smooth' })
  await wait(1200)
  // bookmarks, history, settings (themes, text size), about
  await menu('/bookmarks')
  await menu('/history')
  await menu('/settings')
  await tap('[data-testid=theme-dark]'); await wait(1500)
  await tap('[data-testid=theme-sepia]'); await wait(1500)
  await tap('[data-testid=theme-light]'); await wait(1000)
  await menu('/about')
  await scroll(500, 2000)
  await menu('/dict/sankshiptha')
  await wait(1500)
  await menu('/')
  await wait(1500)
  document.title = 'demo-done'
})().catch(e => { document.title = 'demo-error: ' + e.message })
