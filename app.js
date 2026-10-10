const $ = s => document.querySelector(s), T = m => Metro.toStr(m) + (m >= 1440 ? ' (+1)' : '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pickd = { from: null, to: null };
let last = null;
const DB = {
  open: () => new Promise((res, rej) => { const q = indexedDB.open('journeys', 1); q.onupgradeneeded = () => q.result.createObjectStore('j', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }),
  async run(mode, f) { const db = await DB.open(); return new Promise((res, rej) => { const tx = db.transaction('j', mode), r = f(tx.objectStore('j')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }); },
  all: () => DB.run('readonly', s => s.getAll()), put: v => DB.run('readwrite', s => s.put(v)), del: id => DB.run('readwrite', s => s.delete(id))
};
async function drawSaved() {
  try { const all = (await DB.all() || []).sort((x, y) => y.id - x.id);
    $('#saved').innerHTML = all.length ? '<h2>Saved journeys (work offline)</h2>' + all.map(s => `<div class="fare"><button class="lnk" data-open="${s.id}">${esc(s.plan.from.name)} → ${esc(s.plan.to.name)}<br><span class="small">${T(s.plan.leave)} → ${T(s.plan.arrive)} · ${s.plan.minutes} min · saved ${esc(s.when)}</span></button><button class="lnk" data-del="${s.id}" aria-label="Delete">✕</button></div>`).join('') : '';
    window.__saved = all; } catch (e) { $('#saved').innerHTML = '<p class="small">Saving not available in this browser.</p>'; }
}
function pick(k) {
  const q = $('#q-' + k), r = $('#r-' + k);
  q.addEventListener('input', () => { pickd[k] = null; const hits = Journey.search(q.value); r.innerHTML = hits.map(h => `<button data-k="${h.key}">${esc(h.name)}</button>`).join(''); });
  r.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pickd[k] = b.dataset.k; q.value = Journey.place(b.dataset.k).name; r.innerHTML = ''; });
}
const basis = l => l.basis === 'estimate' || (l.est && l.type === 'bus' && !l.boardReal) ? 'ESTIMATE' : l.type === 'bus' ? (l.boardReal ? 'REAL' : 'ESTIMATE') : l.basis === 'timetable' ? (l.est ? 'ESTIMATE' : 'REAL') : '';
function legHtml(l) {
  if (l.type === 'walk') return `<div class="leg"><span class="tm">${T(l.dep)}</span><span>Walk ${l.arr - l.dep} min (${l.dist} m)<span class="tag ESTIMATE">ESTIMATE</span><br><span class="small">${esc(l.from)} → ${esc(l.to)}</span></span></div>`;
  const name = l.type === 'metro' ? l.line + ' line' : `${l.agency === 'AJL' ? 'BRTS' : l.agency} ${esc(l.route)} → ${esc(l.headsign)}`;
  const dep = l.type === 'bus' && !l.boardReal ? 'about ' + T(l.dep) : T(l.dep);
  return `<div class="leg ${l.type}"><span class="tm">${T(l.dep)}</span><span><b>${name}</b><span class="tag ${basis(l)}">${basis(l)}</span><br>${esc(l.from)} → ${esc(l.to)}<br><span class="small">${l.wait ? 'wait ' + l.wait + ' min' + (l.type === 'bus' && !l.boardReal ? ' (estimated)' : '') + ', ' : ''}board ${dep}, ride ${l.arr - l.dep} min, ${l.stops} stops, arrive ${T(l.arr)}${l.type === 'bus' ? ' (ride time estimated)' : ''}</span></span></div>`;
}
function draw(r) {
  last = r;
  if (r.error) { $('#out').innerHTML = `<p class="gap">No route found${r.direct_m ? ` (straight-line ${r.direct_m} m)` : ''}. Try a later time: regular metro service ends late evening.</p>`; return; }
  const f = r.fare, fl = f.items.map(i => `<div class="fare"><span>${esc(i.operator)}<span class="tag ${i.status}">${i.status}</span><br><span class="small">${esc(i.label)}</span></span><b>${i.inr ? '₹' + i.inr : 'n/a'}</b></div>`).join('') || '<p class="small">Walking only: no fare.</p>';
  const warn = (f.missing ? `Total excludes ${f.missing} leg(s) with no fare data. ` : '') + (f.sample ? 'Includes SAMPLE metro fare.' : '');
  $('#out').innerHTML = `<div class="sum"><span class="t"><b>${T(r.leave)} → ${T(r.arrive)}</b></span><span>${r.minutes} min · ${f.total ? '₹' + f.total : '₹0'}${f.missing || f.sample ? ' *' : ''}</span></div>` + `<p class="small">Walk ${r.breakdown.walk} min · In vehicle ${r.breakdown.ride} min · Waiting ${r.breakdown.wait} min</p>` + (r.alt ? `<p class="small">Metro-only alternative: arrives ${T(r.alt.arrive)} (${r.alt.minutes} min, waiting ${r.alt.breakdown.wait} min). ${r.alt.arrive > r.arrive ? 'The chosen route is ' + (r.alt.arrive - r.arrive) + ' min earlier, but relies on ESTIMATED bus times.' : 'Metro-only is not slower.'}</p>` : '') + (r.breakdown.wait >= 60 ? `<p class="gap">Long wait: ${r.breakdown.wait} min waiting, likely outside normal service hours. First departure used is the first real/estimated one after ${T(r.leave)}.</p>` : '') + (warn ? `<p class="small">* ${warn}</p>` : '') + r.legs.map(legHtml).join('') + (r.__saved ? '<p class="small">Saved card, shown as stored (not recalculated).</p>' : '') + (r.longWalk > 800 ? `<p class="gap">Long walk (${r.longWalk} m): no bus stop close by here. Plan a cab, pickup or feeder.</p>` : '') + '<h2>Fare breakdown</h2>' + fl + split(r) + (r.__saved ? '' : '<button id="save" class="go full">Save this journey</button>');
}
function split(r) {
  const sp = Journey.split(r.legs, r.fare.total); if (sp.length < 2) return '';
  return '<h2>Proposed fare split <span class="tag ESTIMATE">PROPOSAL</span></h2><p class="small">One ticket, total shared by in-vehicle km. ' + (r.fare.missing ? 'AMTS fare is unknown, so this splits only the known total (illustration of the method). ' : '') + 'A clearing house would settle this between operators (PPP-ready).</p>' + sp.map(x => `<div class="fare"><span>${esc(x.operator)}<br><span class="small">${x.km} km · ${x.pct}%</span></span><b>₹${x.inr}</b></div>`).join('');
}
const PRE = [['Mahatma Mandir → APMC', 'M:mahatma-mandir', 'M:apmc', '08:00'], ['Thaltej Gam → Sachivalaya', 'M:thaltej-gam', 'M:sachivalaya', '10:00'], ['Ranip → Sola (bus)', 'M:ranip', 'B:@SOLA@', '10:00']];
function setPick(k, key) { pickd[k] = key; $('#q-' + k).value = Journey.place(key).name; }
function go() {
  if (!pickd.from || !pickd.to) { $('#out').innerHTML = '<p class="gap">Pick both places from the lists.</p>'; return; }
  draw(Journey.plan(pickd.from, pickd.to, Metro.toMin($('#time').value || '08:00')));
}
pick('from'); pick('to');
$('#go').addEventListener('click', () => { if (!window.Journey || !window.__ready) { $('#out').innerHTML = '<p class="gap">Still loading or failed to load: ' + esc(window.__err || 'wait a moment') + '</p>'; return; } try { go(); } catch (e) { $('#out').innerHTML = '<p class="gap">Error: ' + esc(e.message) + '</p>'; console.error(e); } });
const n = new Date(); $('#time').value = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
$('#out').addEventListener('click', async e => { if (e.target.id !== 'save' || !last) return; const p = JSON.parse(JSON.stringify(last)); await DB.put({ id: Date.now(), when: new Date().toLocaleString(), plan: p }); e.target.textContent = 'Saved ✓'; drawSaved(); });
$('#saved').addEventListener('click', async e => { const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
  if (o) { const s = (window.__saved || []).find(x => x.id == o.dataset.open); if (s) { s.plan.__saved = 1; draw(s.plan); scrollTo(0, 0); } }
  if (d) { await DB.del(+d.dataset.del); drawSaved(); } });
(async () => {
  drawSaved();
  try {
    if (!window.Journey) throw new Error('lib/journey.js not found (is it inside the lib/ folder?)');
    await Journey.load('data/');
    pickd.from = 'M:mahatma-mandir'; pickd.to = 'M:apmc'; $('#q-from').value = Journey.place(pickd.from).name; $('#q-to').value = Journey.place(pickd.to).name;
    const sola = Journey.search('Sola Bhagwat').find(x => x.key[0] === 'B'); if (sola) PRE[2][2] = sola.key;
    $('#pre').innerHTML = PRE.map((p, i) => `<button data-i="${i}">${esc(p[0])}</button>`).join('') + '<button id="swap">⇄ Swap</button>';
    $('#pre').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'swap') { const f = pickd.from; setPick('from', pickd.to); setPick('to', f); } else { const p = PRE[+b.dataset.i]; setPick('from', p[1]); setPick('to', p[2]); $('#time').value = p[3]; } go(); });
    window.__ready = 1;
  } catch (e) { window.__err = e.message; $('#out').innerHTML = '<p class="gap">Load error: ' + esc(e.message) + (location.protocol === 'file:' ? '<br>You opened this file directly. Browsers block loading data files that way. Run <code>python3 -m http.server 8000</code> in this folder, then open http://localhost:8000' : '') + '</p>'; console.error(e); }
})();
const badge = $('#badge'), net = () => { if (badge.dataset.ready) badge.textContent = navigator.onLine ? 'Offline-ready' : 'Offline (cached)'; };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => { badge.dataset.ready = 1; badge.className = 'ok'; net(); });
else badge.textContent = 'no service worker (use localhost)';
addEventListener('online', net); addEventListener('offline', net);
