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
