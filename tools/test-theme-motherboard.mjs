import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ Math, Object, Array, Uint8Array, String, Number, JSON });
context.globalThis = context;
for (const file of ['theme-motherboard.js', 'theme-cells.js', 'theme-quake.js', 'theme-gems.js', 'theme-wind.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const { EvertaleMotherboard: board, EvertaleCells: cells, EvertaleQuake: quake, EvertaleGems: gems, EvertaleWind: wind } = context;
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

test('earthquakes: 5 (phone 3) varied quakes, banded cracks, staggered timing', () => {
  for (const mobile of [false, true]) {
    const list = quake.layout({ key: 'groudon', mobile });
    assert.equal(list.length, mobile ? quake.limits.phone : quake.limits.desktop);
    assert.equal(JSON.stringify(list), JSON.stringify(quake.layout({ key: 'groudon', mobile })));
    const radii = list.map(q => q.radius);
    assert.ok(Math.max(...radii) - Math.min(...radii) > 15, 'sizes vary');
    for (const q of list) {
      assert.equal(q.bands.length, quake.bands);
      assert.ok(q.bands[0].length > 0, 'centre band has cracks');
      for (const dpath of q.bands) { assert.doesNotMatch(dpath, /NaN|Infinity/); assert.ok(numbers(dpath).every(v => v >= -q.size * .5 && v <= q.size * 1.5)); }
      assert.ok(q.duration >= 9 && q.duration <= 14 && q.delay <= 0 && q.x >= 5 && q.x <= 95 && q.y >= 8 && q.y <= 92);
    }
  }
});

test('gems: each version game shows its own cut, within budget', () => {
  const cuts = { ruby: 'oval', sapphire: 'oval', emerald: 'emerald', diamond: 'brilliant', pearl: 'pearl', gold: 'ingot', silver: 'ingot', platinum: 'ingot' };
  for (const [key, cut] of Object.entries(cuts)) {
    for (const mobile of [false, true]) {
      const list = gems.layout({ key, mobile });
      assert.equal(list.length, mobile ? gems.limits.phone : gems.limits.desktop);
      assert.ok(list.every(g => g.cut === cut && g.key === key && g.width >= 34 && g.width <= 90 && g.sweep >= 6 && g.delay <= 0));
    }
  }
  assert.equal(gems.layout({ key: 'unknown' })[0].key, 'diamond');
});

test('wind: bounded streak lines with finite geometry', () => {
  for (const [w, h, mobile] of sizes) {
    const plan = wind.layout(w, h, { key: 'rayquaza', mobile });
    assert.equal(plan.lines.length, mobile ? wind.limits.phone : wind.limits.desktop);
    for (const line of plan.lines) {
      assert.doesNotMatch(line.d, /NaN|Infinity/);
      assert.ok(line.len > 0 && line.seg >= 60 && line.seg < line.len + 60 && line.duration > 3 && line.delay <= 0);
    }
  }
});

test('stylesheet animates only transform and opacity (wind dash offset excepted), and honours pause, still and reduced motion', () => {
  const css = fs.readFileSync(path.join(root, 'theme-motherboard.css'), 'utf8');
  for (const block of css.match(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})+\s*\}/g) || []) {
    const allowed = block.startsWith('@keyframes tw-gust') ? ['transform', 'opacity', 'stroke-dashoffset'] : ['transform', 'opacity'];
    for (const decl of block.match(/[a-z-]+(?=:)/g) || []) assert.ok(allowed.includes(decl), `keyframe property ${decl}`);
  }
  assert.doesNotMatch(css, /:is\([^)]*::/, 'no pseudo-elements inside :is()');
  assert.match(css, /data-theme-motion="paused"\] :is\(\.tmbPulse,\.tcCell\)\{animation-play-state:paused!important\}/);
  assert.match(css, /data-theme-still="true"\] \.tmbPulse\{display:none!important\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:700px\)\{\.tcCell\[data-mobile="false"\]\{display:none\}\}/, 'cells use the shared 700px density breakpoint');
  const js = fs.readFileSync(path.join(root, 'theme-motherboard.js'), 'utf8');
  assert.match(js, /matchMedia\?\.\('\(max-width:700px\)'\)/, 'board uses the shared 700px density breakpoint');
});

test('Miraidon Hadron cycle coordinates actual drawn waypoint arrivals',()=>{
  for(const [w,h,mobile] of sizes){
    const plan=board.layout(w,h,{key:'miraidon',mobile});
    assert.ok(plan.hadron.cycle>=16);
    assert.ok(plan.hadron.nodes.length>=1&&plan.hadron.nodes.length<=(mobile?1:2));
    for(const p of plan.pulses){
      assert.equal(p.duration,plan.hadron.cycle);
      assert.ok(Math.abs(p.delay+p.duration*.18)<1e-8);
      assert.ok(p.start>=12&&p.end>p.start&&p.end<=80.001);
    }
    for(const n of plan.hadron.nodes){
      const p=plan.pulses[n.pulse],pts=p.reverse?[...p.points].reverse():p.points;
      const a=pts[n.waypoint-1],b=pts[n.waypoint];
      assert.equal(n.x,b[0]);assert.equal(n.y,b[1]);
      const dist=pts.slice(1,n.waypoint+1).reduce((s,pt,i)=>s+Math.hypot(pt[0]-pts[i][0],pt[1]-pts[i][1]),0);
      assert.ok(Math.abs(n.at-(p.start+(p.end-p.start)*dist/p.length))<1e-8);
      assert.ok(Math.abs((n.from[0]-a[0])*(b[1]-a[1])-(n.from[1]-a[1])*(b[0]-a[0]))<1e-6);
      assert.ok(Math.hypot(n.from[0]-b[0],n.from[1]-b[1])<=34.00001);
    }
  }
  for(const key of ['cyber','crimsonblack','cobaltblack','metallicrose','bronzexl','blackwhitedsi','galaxystyle','superfamicom']){
    const plan=board.layout(1280,800,{key});
    assert.equal(plan.hadron,undefined);
    assert.ok(plan.pulses.every(p=>p.start===undefined&&p.end===undefined));
  }
});

test('Yveltal has independently seeded and budgeted decay fissures',()=>{
  for(const mobile of [false,true]){
    const list=quake.layout({key:'yveltal',mobile});
    assert.equal(list.length,mobile?2:3);
    assert.equal(JSON.stringify(list),JSON.stringify(quake.layout({key:'yveltal',mobile})));
    assert.ok(list.every(x=>x.bands.length===quake.bands));
  }
});
