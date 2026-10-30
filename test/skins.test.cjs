// node --test test/skins.test.cjs: the widget's hud skins (skins.js), what doesn't need a page
const test = require('node:test');
const assert = require('node:assert');
const SKIN = require('../skins.js');

test('a skin the page does not know is classic', () => {
  for (const s of SKIN.SKINS) assert.strictEqual(SKIN.pick(s), s);
  for (const s of [undefined, null, '', 'manga', 3]) assert.strictEqual(SKIN.pick(s), 'classic');
});

test('the theme: light, dark, or auto following the system', () => {
  for (const skin of ['classic', 'drawer', undefined]) {
    assert.strictEqual(SKIN.theme(skin, 'light', true), 'light');
    assert.strictEqual(SKIN.theme(skin, 'dark', false), 'dark');
    assert.strictEqual(SKIN.theme(skin, 'auto', true), 'dark');
    assert.strictEqual(SKIN.theme(skin, 'auto', false), 'light');
    assert.strictEqual(SKIN.theme(skin, undefined, true), 'light', 'no setting yet is light');
    assert.strictEqual(SKIN.theme(skin, 'sepia', true), 'light');
  }
});

test('the scouter is always dark and capsule corp always light', () => {
  for (const setting of ['light', 'dark', 'auto']) for (const sys of [false, true]) {
    assert.strictEqual(SKIN.theme('scouter', setting, sys), 'dark');
    assert.strictEqual(SKIN.theme('capsule', setting, sys), 'light');
  }
});

test("the scouter's segments light once whole", () => {
  assert.deepStrictEqual([0, .08, 1 / 12, .5, .99, 1, 1.4, -1, NaN].map(p => SKIN.lit(p, 12)), [0, 0, 1, 6, 11, 12, 12, 0, 0]);
});

test("capsule corp's gauge: full capsules, then a half one", () => {
  assert.deepStrictEqual(SKIN.caps(0), Array(8).fill(''));
  assert.deepStrictEqual(SKIN.caps(.11), ['half', '', '', '', '', '', '', '']);
  assert.deepStrictEqual(SKIN.caps(.25), ['on', 'on', '', '', '', '', '', '']);
  assert.deepStrictEqual(SKIN.caps(.3), ['on', 'on', 'half', '', '', '', '', '']);
  assert.deepStrictEqual(SKIN.caps(1), Array(8).fill('on'));
});

test("the drawer's tabs count what's ready", () => {
  const items = { boots: { can: true }, bubbles: { can: false }, gravity: { can: true }, ascend: { can: false, open: true } };
  const menu = { tree: [{ can: true }, { can: false }, { can: true }, { can: true }], chars: [{ open: true, on: true }, { open: true }, { open: false }] };
  assert.deepStrictEqual(SKIN.counts(items, menu), { up: 2, tree: 3, heroes: [2, 3] });
  assert.deepStrictEqual(SKIN.counts({}, {}), { up: 0, tree: 0, heroes: [0, 0] }, 'before the first shop and menu');
  assert.deepStrictEqual(SKIN.counts(undefined, undefined), { up: 0, tree: 0, heroes: [0, 0] });
});

test("the form's short name", () => {
  assert.strictEqual(SKIN.formName({ name: 'base', x: 1 }), 'base');
  assert.strictEqual(SKIN.formName({ name: 'super saiyan 3', x: 3 }), 'ssj 3 ×3');
  assert.strictEqual(SKIN.formName({ name: 'kaioken', x: 1 }), 'kaioken');
});

test('the scouter keeps to the side of the planet at every widget size', () => {
  const lens = { w: 199, h: 96 }, tray = { w: 30, h: 138 };
  // the planet where the core draws it in the widget at 300, 400 and 720 pt
  for (const [W, P] of [[300, { x: 150, y: 131, r: 57 }], [400, { x: 200, y: 178, r: 71 }], [720, { x: 360, y: 338, r: 138 }]]) {
    const f = SKIN.fit(P, W, W, lens, tray);
    const into = (x0, y0, x1, y1) => P.r - Math.hypot(Math.max(x0 - P.x, 0, P.x - x1), Math.max(y0 - P.y, 0, P.y - y1));
    assert.ok(f.k >= .7 && f.k <= 1, `${W}: the lens at ${f.k}`);
    assert.ok(into(W - 8 - f.k * lens.w, 8, W - 8, 8 + f.k * lens.h) <= P.r * .25, `${W}: the lens reaches past the rim`);
    assert.ok(into(W - 8 - f.kt * tray.w, f.top, W - 8, f.top + f.kt * tray.h) < 0, `${W}: the buttons are on the planet`);
    assert.ok(f.top + f.kt * tray.h <= W - 8, `${W}: the buttons leave the window`);
    const s = f.shop;
    assert.ok(s.left >= 8 && s.right >= 8 && s.top + s.h <= W - 8 && s.h >= 90, `${W}: the upgrades leave the window`);
    assert.ok(into(s.left, s.top, W - s.right, s.top + s.h) <= P.r * .5, `${W}: the upgrades cover the planet`);
  }
  assert.strictEqual(SKIN.fit({ x: 360, y: 338, r: 138 }, 720, 720, lens, tray).shop.top, SKIN.fit({ x: 360, y: 338, r: 138 }, 720, 720, lens, tray).top, 'room beside the planet: the upgrades go there, under the lens');
  assert.ok(SKIN.fit({ x: 150, y: 131, r: 57 }, 300, 300, lens, tray).shop.top > 131, 'no room beside it: under it');
});
