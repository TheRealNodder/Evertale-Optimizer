import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ Math, Object, Array, Uint8Array, String, Number, JSON });
context.globalThis = context;
for (const file of ['theme-motherboard.js', 'theme-cells.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const { EvertaleMotherboard: board, EvertaleCells: cells } = context;
const sizes = [[1280, 800, false], [1920, 1080, false], [600, 900, false], [390, 844, true]];
const numbers = text => (text.match(/-?\d+(\.\d+)?/g) || []).map(Number);

test('motherboard layout is deterministic per theme, size and device', () => {
  for (const [w, h, mobile] of sizes) {
    const a = JSON.stringify(board.layout(w, h, { key: 'miraidon', mobile }));
    assert.equal(a, JSON.stringify(board.layout(w, h, { key: 'miraidon', mobile })));
  }
  assert.notEqual(JSON.stringify(board.layout(1280, 800, { key: 'miraidon' })), JSON.stringify(board.layout(1280, 800, { key: 'cyber' })));
});

test('board has traces in three widths, parts, pads and vias, with finite coordinates', () => {
  for (const [w, h, mobile] of sizes) {
    const plan = board.layout(w, h, { key: 'cyber', mobile });
    assert.ok(plan.traces.filter(Boolean).length >= 2, `trace widths at ${w}x${h}`);
    for (const dpath of [...plan.traces, plan.parts, plan.pads, plan.vias]) {
      assert.doesNotMatch(dpath, /NaN|Infinity|undefined/);
      assert.ok(numbers(dpath).every(Number.isFinite));
    }
    assert.ok(plan.parts.length > 200, 'chips and components are drawn');
    assert.ok(plan.counts.chips >= 2 && plan.counts.traces >= 8);
  }
});

test('pulses stay within budget and travel only along drawn trace points inside the board', () => {
  for (const [w, h, mobile] of sizes) {
    const plan = board.layout(w, h, { key: 'superfamicom', mobile });
    const limit = mobile ? board.limits.phone.pulses : board.limits.desktop.pulses;
    assert.ok(plan.pulses.length >= 1 && plan.pulses.length <= limit, `${plan.pulses.length} pulses at ${w}x${h}`);
    const drawn = plan.traces.join('');
    for (const pulse of plan.pulses) {
      assert.ok(pulse.duration >= 3.5 && pulse.delay <= 0);
      for (const [x, y] of pulse.points) {
        assert.ok(x >= -1 && y >= -1 && x <= w + 1 && y <= h + 1);
        const fx = v => String(Math.round(v * 10) / 10);
        assert.ok(drawn.includes(`${fx(x)} ${fx(y)}`), `pulse waypoint ${x},${y} is on a drawn trace`);
      }
    }
  }
});

test('every technology theme gets 1..cap packets at phone, tablet and desktop sizes', () => {
  const keys = ['miraidon', 'cyber', 'crimsonblack', 'cobaltblack', 'metallicrose', 'bronzexl', 'blackwhitedsi', 'galaxystyle', 'superfamicom'];
  const cases = [[390, 844, true], [600, 800, true], [1280, 800, false]];
  for (const key of keys) for (const [w, h, mobile] of cases) {
    const plan = board.layout(w, h, { key, mobile });
    const cap = mobile ? board.limits.phone.pulses : board.limits.desktop.pulses;
    assert.ok(plan.pulses.length >= 1 && plan.pulses.length <= cap, `${key} ${w}x${h}: ${plan.pulses.length} packets`);
    for (const pulse of plan.pulses) for (const [x, y] of pulse.points) assert.ok(x >= -1 && y >= -1 && x <= w + 1 && y <= h + 1, `${key} ${w}x${h} packet in bounds`);
  }
});

test('organic cells are filled, varied in size, bounded and phone-limited', () => {
  const list = cells.layout({ key: 'zygarde' });
  assert.equal(list.length, cells.limits.desktop);
  assert.equal(list.filter(c => c.mobile).length, cells.limits.phone);
  const sizesSeen = list.map(c => c.size);
  assert.ok(Math.min(...sizesSeen) >= 18 && Math.max(...sizesSeen) <= 110);
  assert.ok(Math.max(...sizesSeen) - Math.min(...sizesSeen) > 40, 'sizes vary');
  for (const c of list) {
    assert.ok(c.x >= 3 && c.x <= 97 && c.y >= 4 && c.y <= 96);
    assert.ok(c.opacity >= .38 && c.opacity <= .7 && c.duration >= 7 && c.duration <= 14 && c.delay <= 0);
  }
  assert.equal(JSON.stringify(list), JSON.stringify(cells.layout({ key: 'zygarde' })));
});

test('stylesheet animates only transform and opacity, and honours pause, still and reduced motion', () => {
  const css = fs.readFileSync(path.join(root, 'theme-motherboard.css'), 'utf8');
  for (const block of css.match(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})+\s*\}/g) || []) {
    for (const decl of block.match(/[a-z-]+(?=:)/g) || []) assert.ok(['transform', 'opacity'].includes(decl), `keyframe property ${decl}`);
  }
  assert.match(css, /data-theme-motion="paused"\] :is\(\.tmbPulse,\.tcCell\)\{animation-play-state:paused!important\}/);
  assert.match(css, /data-theme-still="true"\] \.tmbPulse\{display:none!important\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:700px\)\{\.tcCell\[data-mobile="false"\]\{display:none\}\}/, 'cells use the shared 700px density breakpoint');
  const js = fs.readFileSync(path.join(root, 'theme-motherboard.js'), 'utf8');
  assert.match(js, /matchMedia\?\.\('\(max-width:700px\)'\)/, 'board uses the shared 700px density breakpoint');
});
