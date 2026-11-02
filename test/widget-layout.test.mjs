// node --test test/widget-layout.test.mjs: the widget page is the phone layout at every size (widget-layout.mjs)
import test from 'node:test'
import assert from 'node:assert'
import { phoneLayout } from '../widget-layout.mjs'

test('the 760px breakpoint always holds, and the 761px one never does', () => {
  const css = '@media (max-width: 760px) { a {} } @media (max-width:760px) and (hover: hover) { b {} } @media (width <= 760px) { c {} }'
    + ' @media (min-width: 761px) { d {} } @media (min-width: 761px) and (orientation: portrait) { e {} } @media (min-width: 761px) and (min-height: 600px) { f {} }'
    + ' @media (max-width: 560px) { g {} } @media print, (min-width: 761px) { h {} } @media (prefers-reduced-motion: reduce) { i {} }'
  assert.strictEqual(phoneLayout(css), '@media all { a {} } @media (hover: hover) { b {} } @media all { c {} }'
    + ' @media not all { d {} } @media not all { e {} } @media not all { f {} }'
    + ' @media (max-width: 560px) { g {} } @media print { h {} } @media (prefers-reduced-motion: reduce) { i {} }')
})

test("page.html's narrow() is always true, and a breakpoint the build can't place fails it", () => {
  assert.strictEqual(phoneLayout('const narrow = () => innerWidth <= 760; x'), 'const narrow = () => true; x')
  assert.throws(() => phoneLayout('if (innerWidth <= 760) go()'), /breakpoint/)
  assert.throws(() => phoneLayout("matchMedia('(min-width: 761px)')"), /breakpoint/)
})
