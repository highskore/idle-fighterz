// The widget page's layout, kept apart from build.mjs so test/widget-layout.test.mjs can load it without building

// the widget is the phone layout at any size: a window stretched past 760px (window mode, the app's fullscreen) would
// otherwise get the site's desktop layout over its own, a second upgrades list, bare toasts and site-wide overlays among
// it. In each media query a 760px max-width condition always holds and a 761px min-width one never does; page.html's
// narrow() is always true. Run on the page before widget.css goes in, which keeps its own wide-window rules
const MAX = /\(\s*(max-width\s*:\s*760px|width\s*<=?\s*760px)\s*\)/, MIN = /\(\s*(min-width\s*:\s*761px|width\s*>=?\s*76[01]px)\s*\)/
export function phoneLayout(page) {
  page = page.replace(/@media([^{;]*)\{/g, (_, prelude) => {
    const queries = prelude.split(',').filter(q => !MIN.test(q))
      .map(q => q.replace(new RegExp(`${MAX.source}\\s*and\\s*|\\s*and\\s*${MAX.source}|${MAX.source}`, 'g'), '').trim())
    return queries.length ? `@media ${queries.map(q => q || 'all').join(', ')} {` : '@media not all {'
  })
  page = page.replace('const narrow = () => innerWidth <= 760;', 'const narrow = () => true;')
  if (/(max|min)-width\s*:\s*76[01]px|width\s*[<>]=?\s*76[01]px|innerWidth\s*[<>]=?\s*76[01]|const narrow = \(\) => innerWidth/.test(page)) throw new Error('a site breakpoint is left in the widget page')
  return page
}
