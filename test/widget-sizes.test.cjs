// node --test test/widget-sizes.test.cjs: the widget's window-mode sizes (world.js fillScale, uiScale), what doesn't need a page
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const src = fs.readFileSync(require.resolve('../world.js'), 'utf8');
const W = {};
vm.runInNewContext(src.slice(src.indexOf('/*widget*/') + 10, src.indexOf('/*/widget*/')) + ';Object.assign(this, { fillScale, uiScale, PLANET_FLOOR })', W);
const SIZES = ['small', 'medium', 'large', 'huge'];
const scales = (w, h) => SIZES.map(s => W.fillScale(w, h, W.PLANET_FLOOR[s], Math.round(40 * W.uiScale(w, h, 'medium'))));

test('each planet size is its own where the window allows, and never smaller than the one before', () => {
  const want = { '480x360': [1, 1, 2, 2], '900x700': [2, 3, 4, 4], '1512x945': [3, 4, 5, 6], '1920x1080': [4, 5, 6, 6], '2560x1440': [5, 7, 8, 9] };
  for (const [wh, ks] of Object.entries(want)) {
    const [w, h] = wh.split('x').map(Number);
    assert.deepStrictEqual(scales(w, h), ks, wh);
  }
});

test('the scene keeps its floor, and the planet at its biggest clears the HUD', () => {
  for (const [w, h] of [[480, 360], [900, 700], [1512, 945], [1920, 1080], [2560, 1440], [2560, 800], [3840, 2160]]) for (const s of SIZES) {
    const room = Math.round(40 * W.uiScale(w, h, 'medium')), k = W.fillScale(w, h, W.PLANET_FLOOR[s], room);
    if (k === 1) continue;
    assert.ok(Math.min(w, h) / k >= W.PLANET_FLOOR[s], `${w}x${h} ${s}: the scene`);
    assert.ok(56 * k * 1.22 <= h / 2 - room, `${w}x${h} ${s}: the HUD`);
  }
});

test('a scale holds while the window is resized a little', () => {
  const k = W.fillScale(1512, 945, 200);
  assert.strictEqual(W.fillScale(1300, 790, 200, 40, k), k, 'a little smaller');
  assert.strictEqual(W.fillScale(1300, 790, 200, 40), k - 1, 'from nothing it would step down');
  assert.strictEqual(W.fillScale(1200, 700, 200, 40, k), W.fillScale(1200, 700, 200), 'a lot smaller: it steps');
});

test('the UI grows with the window from 640px, capped at twice, times the pick', () => {
  assert.deepStrictEqual(SIZES.map(s => W.uiScale(480, 360, s)), [.8, 1, 1.25, 1.5]);
  assert.deepStrictEqual(SIZES.map(s => W.uiScale(1512, 945, s)), [1.18, 1.48, 1.85, 2.21]);
  assert.deepStrictEqual(SIZES.map(s => W.uiScale(3840, 2160, s)), [1.6, 2, 2.5, 3]);
  assert.strictEqual(W.uiScale(1512, 945, 'giant'), 1.48, 'an unknown pick is medium');
});
