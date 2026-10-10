/* Journey planner: Metro + BRTS (AJL) + AMTS + GTSL. Needs lib/metro.js loaded first. Works in browser (global `Journey`) and Node.
   Every leg carries `basis`: 'timetable' (published times), 'gtfs' (real bus departure), or 'estimate' (see ASSUME). */
(function (root) {
  const M = typeof module !== 'undefined' && module.exports ? require('./metro.js') : root.Metro;
  const J = {}; let G = null;
  // ---- ASSUMPTIONS (all surfaced in the UI) ----
  const ASSUME = J.ASSUME = {
    walkMperMin: 75, detour: 1.3, maxWalkM: 800, transferWalkM: 250,
    metroBoardBuf: 3,      // min from arriving at a station to boarding a train (ticket gate + platform)
    busBoardBuf: 1,
    busKmh: 18, busDwell: 0.5,   // bus ride time is estimated: the GTFS feed has no per-stop times
    ewHopMin: 45 / 17,     // East-West line: 45 min end to end (service_rules.json), no trip-level timetable
    penalty: 5             // minutes of "cost" per vehicle boarding, to prefer fewer transfers (not shown as time)
  };
  const walkMin = m => Math.ceil(m * ASSUME.detour / ASSUME.walkMperMin);

  J.load = async function (base = 'data/') {
    await M.load(base);
    const get = (typeof window !== 'undefined' && typeof fetch === 'function') ? async n => (await fetch(base + n)).json() : async n => JSON.parse(require('fs').readFileSync(base + n, 'utf8'));
    const [bs, rs, sr] = await Promise.all(['bus_stops.json', 'bus_route_stops.json', 'bus_stop_routes.json'].map(get));
    const D = M.data(); G = { D, stops: {}, rd: [], stopRD: {}, svc: sr.stop_routes, routeIdx: {}, grid: {}, metroNear: {}, busNearMetro: {} };
    bs.stops.forEach(([id, name, lat, lon]) => { G.stops[id] = { id, name, lat, lon }; const k = gk(lat, lon); (G.grid[k] = G.grid[k] || []).push(id); });
    D.routes.forEach((r, i) => G.routeIdx[r[0]] = i);
    rs.route_stops.forEach(([rid, dir, head, ids]) => {
      ids = ids.filter(s => G.stops[s]); if (ids.length < 2) return;
      const cum = [0]; for (let i = 1; i < ids.length; i++) { const a = G.stops[ids[i - 1]], b = G.stops[ids[i]]; cum.push(cum[i - 1] + M.haversine(a.lat, a.lon, b.lat, b.lon) * 1.3 / (ASSUME.busKmh * 1000 / 60) + ASSUME.busDwell); }
      const k = G.rd.push({ rid, dir, head, ids, cum, ri: G.routeIdx[rid], agency: D.routes[G.routeIdx[rid]][1] }) - 1;
      ids.forEach((s, p) => (G.stopRD[s] = G.stopRD[s] || []).push([k, p]));
    });
    Object.entries(D.near).forEach(([st, arr]) => arr.forEach(s => { (G.metroNear[st] = G.metroNear[st] || []).push({ stop: s.stop_id, d: s.dist_m }); (G.busNearMetro[s.stop_id] = G.busNearMetro[s.stop_id] || []).push({ st, d: s.dist_m }); }));
    // metro trips indexed by station
    G.stTrips = {}; D.trips.forEach(t => M.tripTimes(t.id).forEach((x, i, a) => (G.stTrips[x.station] = G.stTrips[x.station] || []).push({ t, i, min: x.min, path: a })));
    Object.values(G.stTrips).forEach(a => a.sort((x, y) => x.min - y.min));
    G.ew = D.corr.EW; G.freq = D.rules.lines.L1;
    return G;
  };
  const gk = (lat, lon) => Math.floor(lat / 0.005) + ':' + Math.floor(lon / 0.005);
  function nearStops(lat, lon, maxM) {
    const out = [], a = Math.floor(lat / 0.005), b = Math.floor(lon / 0.005), r = Math.ceil(maxM / 450);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const id of G.grid[(a + i) + ':' + (b + j)] || []) { const s = G.stops[id], d = M.haversine(lat, lon, s.lat, s.lon); if (d <= maxM) out.push({ id, d }); }
    return out;
  }
  const pos = key => { if (key[0] === 'M') { const s = G.D.stations[key.slice(2)]; return s && s.lat ? s : null; } return G.stops[key.slice(2)]; };
  J.stationList = () => Object.values(G.D.stations).filter(s => s.lat).map(s => ({ key: 'M:' + s.id, name: s.name + ' (Metro)', lat: s.lat, lon: s.lon }));
  J.search = q => {
    q = q.trim().toLowerCase(); if (q.length < 2) return [];
    const m = J.stationList().filter(s => s.name.toLowerCase().includes(q));
    const b = Object.values(G.stops).filter(s => s.name.toLowerCase().includes(q)).slice(0, 12).map(s => ({ key: 'B:' + s.id, name: s.name + ' (bus stop)', lat: s.lat, lon: s.lon }));
    return m.concat(b).slice(0, 15);
  };
  J.place = key => { const p = pos(key); return p && { key, name: key[0] === 'M' ? p.name + ' (Metro)' : p.name + ' (bus stop)', lat: p.lat, lon: p.lon }; };

  function ewHeadway(t) { // service_rules.json L1 (weekday assumed)
    if (t < 380 || t >= 1380) return null;
    if (t < 420 || t >= 1320) return 20; if ((t >= 480 && t < 660) || (t >= 1020 && t < 1200)) return 7; return 10;
  }
  function busWait(stop, rd, ready) { // returns {dep, basis} or null
    const real = (G.D.deps[stop] || []).find(x => x.route === rd.rid && x.headsign === rd.head);
    if (real) { const n = real.times.find(t => t >= ready); return n === undefined ? null : { dep: n, basis: 'gtfs' }; }
    if ((G.D.deps[stop] || []).some(x => x.route === rd.rid)) return null; // real data exists for this route here but not this direction
    const e = (G.svc[stop] || []).find(x => x[0] === rd.ri); if (!e) return null;
    const [, trips, f, l] = e, fm = M.toMin(f), lm = M.toMin(l); if (ready > lm || trips < 1) return null;
    const ndir = (G.stopRD[stop] || []).filter(x => G.rd[x[0]].ri === rd.ri).length || 1, per = Math.max(1, trips / ndir), hw = per > 1 ? (lm - fm) / (per - 1) : 60;
    return { dep: Math.max(ready + Math.round(hw / 2), fm), basis: 'estimate' };
  }

  // ---- earliest-arrival search with a small penalty per boarding ----
  J.plan = function (from, to, leave, opts = {}) {
    const o = typeof from === 'string' ? J.place(from) : from, d = typeof to === 'string' ? J.place(to) : to;
    if (!o || !d) return { error: 'unknown place' };
    const lab = {}, heap = [];
    const push = (k, cost, arr, prev, leg) => { const L = lab[k]; if (L && L.cost <= cost) return; lab[k] = { cost, arr, prev, leg }; heap.push([cost, k]); up(heap.length - 1); };
    const up = i => { while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (; ;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[i][0] <= heap[c][0]) break;[heap[i], heap[c]] = [heap[c], heap[i]]; i = c; } } return t; };
    const near = (p, maxM) => { const r = nearStops(p.lat, p.lon, maxM).map(x => ({ key: 'B:' + x.id, d: x.d })); Object.values(G.D.stations).forEach(s => { if (!s.lat) return; const dd = M.haversine(p.lat, p.lon, s.lat, s.lon); if (dd <= maxM) r.push({ key: 'M:' + s.id, d: dd }); }); return opts.noBus ? r.filter(x => x.key[0] === 'M') : r; };
    const direct = M.haversine(o.lat, o.lon, d.lat, d.lon);
    near(o, 700).forEach(x => { const w = walkMin(x.d); push(x.key, leave + w, leave + w, 'ORIGIN', { type: 'walk', from: o.name, to: nm(x.key), dist: Math.round(x.d), dep: leave, arr: leave + w }); });
    const goal = {}; near(d, 700).forEach(x => goal[x.key] = x.d);
    let best = null; const done = {};
    while (heap.length) {
      const [cost, k] = pop(); if (done[k] || lab[k].cost !== cost) continue; done[k] = 1;
      if (best && cost > best.cost + 1) break;
      const L = lab[k], t = L.arr;
      if (goal[k] !== undefined) { const w = walkMin(goal[k]), c = L.arr + w + (L.leg.type === 'walk' ? 0 : 0); if (!best || c < best.cost) best = { cost: c, key: k, w, dist: Math.round(goal[k]) }; }
      expand(k, t, L);
    }
    function expand(k, t, L) {
      const kind = k[0], id = k.slice(2), wk = L.leg.type === 'walk';
      if (kind === 'M') {
        if (!wk || true) (G.metroNear[id] || []).forEach(x => { if (wk || opts.noBus) return; const w = walkMin(x.d); push('B:' + x.stop, t + w, t + w, k, { type: 'walk', from: nm(k), to: nm('B:' + x.stop), dist: x.d, dep: t, arr: t + w }); });
        const ready = t + ASSUME.metroBoardBuf, seen = {};
        for (const e of G.stTrips[id] || []) {
          if (e.min < ready) continue; const g = e.t.direction + e.t.pattern; if (seen[g]) continue; seen[g] = 1;
          for (let j = e.i + 1; j < e.path.length; j++) { const a = e.path[j]; push('M:' + a.station, a.min + ASSUME.penalty, Math.round(a.min), k, { type: 'metro', line: e.t.pattern === 'gift_city_branch' ? 'GIFT City branch' : 'North-South', trip: e.t.id, from: nm(k), to: nm('M:' + a.station), fromId: id, toId: a.station, stops: j - e.i, dep: Math.round(e.min), arr: Math.round(a.min), basis: 'timetable', est: a.estimated || e.path[e.i].estimated }); }
        }
        const ei = G.ew.indexOf(id), nEw = G.ew.length, hw = ewHeadway(Math.max(ready, 380));
        // East-West: no trip-level timetable. Before first service (06:20 from both terminals) we wait for the first train; after, half the headway (ESTIMATE).
        if (ei >= 0 && hw && ready < 1380) G.ew.forEach((s, j) => { if (j === ei) return;
          const first = 380 + (j > ei ? ei : nEw - 1 - ei) * ASSUME.ewHopMin, dep = Math.round(ready >= 380 ? Math.max(ready + hw / 2, first) : first), a = Math.round(dep + Math.abs(j - ei) * ASSUME.ewHopMin);
          push('M:' + s, a + ASSUME.penalty, a, k, { type: 'metro', line: 'East-West', from: nm(k), to: nm('M:' + s), fromId: id, toId: s, stops: Math.abs(j - ei), dep, arr: a, basis: 'estimate', est: true, hw }); });
      } else {
        const bn = G.busNearMetro[id] || [];
        if (!wk) { bn.forEach(x => { const w = walkMin(x.d); push('M:' + x.st, t + w, t + w, k, { type: 'walk', from: nm(k), to: nm('M:' + x.st), dist: x.d, dep: t, arr: t + w }); });
          const s0 = G.stops[id]; nearStops(s0.lat, s0.lon, ASSUME.transferWalkM).forEach(x => { if (x.id === id) return; const w = walkMin(x.d); push('B:' + x.id, t + w, t + w, k, { type: 'walk', from: nm(k), to: nm('B:' + x.id), dist: Math.round(x.d), dep: t, arr: t + w }); }); }
        const ready = t + ASSUME.busBoardBuf;
        for (const [ri, p] of G.stopRD[id] || []) {
          const rd = G.rd[ri], w = busWait(id, rd, ready); if (!w) continue;
          for (let j = p + 1; j < rd.ids.length; j++) { const a = Math.round(w.dep + rd.cum[j] - rd.cum[p]); push('B:' + rd.ids[j], a + ASSUME.penalty, a, k, { type: 'bus', route: rd.rid, agency: rd.agency, headsign: rd.head, from: nm(k), to: nm('B:' + rd.ids[j]), fromId: id, toId: rd.ids[j], stops: j - p, dep: w.dep, arr: a, basis: w.basis, est: true, boardReal: w.basis === 'gtfs' }); }
        }
      }
    }
    function nm(key) { return key[0] === 'M' ? 'Metro: ' + M.name(key.slice(2)) : G.stops[key.slice(2)].name; }
    if (!best) return { error: 'no route found', direct_m: Math.round(direct) };
    const legs = []; let k = best.key;
    while (k !== 'ORIGIN') { legs.unshift(lab[k].leg); k = lab[k].prev; }
    if (best.w) legs.push({ type: 'walk', from: nm(best.key), to: d.name, dist: best.dist, dep: lab[best.key].arr, arr: lab[best.key].arr + best.w });
    for (let i = legs.length - 1; i >= 0; i--) if (legs[i].type === 'walk' && legs[i].dist < 20 && legs.length > 1) legs.splice(i, 1);
    // a direct walk beats a journey that is not clearly better
    const wd = walkMin(direct), arrive = legs[legs.length - 1].arr;
    const annotate = (ls, t0) => { let prev = t0, w = 0, r = 0, wt = 0; ls.forEach(l => { l.wait = Math.max(0, l.dep - prev); if (l.type === 'walk') w += l.arr - l.dep; else r += l.arr - l.dep; wt += l.wait; prev = l.arr; }); return { walk: w, ride: r, wait: wt }; };
    const res = { from: o, to: d, leave, arrive, minutes: arrive - leave, legs, breakdown: annotate(legs, leave), fare: J.fare(legs), longWalk: Math.max(0, ...legs.filter(l => l.type === 'walk').map(l => l.dist)), walkOnly: { minutes: wd, m: Math.round(direct) } };
    if (!opts.noBus && legs.some(l => l.type === 'bus')) { const a = J.plan(o, d, leave, { noBus: true }); if (!a.error) res.alt = { arrive: a.arrive, minutes: a.minutes, breakdown: a.breakdown }; }
    if (direct < 1500 && wd <= res.minutes + 5) { const wl = [{ type: 'walk', from: o.name, to: d.name, dist: Math.round(direct), dep: leave, arr: leave + wd }]; return Object.assign(res, { legs: wl, arrive: leave + wd, minutes: wd, breakdown: annotate(wl, leave), fare: J.fare(wl) }); }
    return res;
  };

  // ---- fares: real where the data has it, SAMPLE for metro (no published chart), MISSING for AMTS/GTSL ----
  J.METRO_SAMPLE = [[3, 5], [7, 10], [12, 15], [18, 20], [99, 25]]; // [max stations, INR]  SAMPLE ONLY
  J.fare = function (legs) {
    const items = []; let run = [];
    const flush = () => { if (!run.length) return; const n = run.reduce((a, l) => a + l.stops, 0); items.push({ operator: 'GMRC (Metro)', label: run.map(l => l.from.replace('Metro: ', '') + ' → ' + l.to.replace('Metro: ', '')).join(' + '), inr: J.METRO_SAMPLE.find(x => n <= x[0])[1], status: 'SAMPLE' }); run = []; };
    for (const l of legs) {
      if (l.type === 'metro') { run.push(l); continue; }
      if (l.type !== 'bus') continue;
      flush();
      if (l.agency === 'AJL') { const f = M.brtsFare(l.fromId, l.toId, false); items.push({ operator: 'BRTS (AJL)', label: l.route + ': ' + l.from + ' → ' + l.to, inr: f, status: f ? 'REAL' : 'MISSING' }); }
      else items.push({ operator: l.agency, label: l.route + ': ' + l.from + ' → ' + l.to, inr: null, status: 'MISSING' });
    }
    flush();
    const known = items.filter(i => i.inr);
    return { items, total: known.reduce((a, i) => a + i.inr, 0), missing: items.length - known.length, sample: known.some(i => i.status === 'SAMPLE') };
  };


  // ---- PROPOSED fare split: the total of one integrated ticket shared by in-vehicle km (board stop -> alight stop, straight line x 1.3)
  J.split = function (legs, total) {
    const ll = (t, id) => t === 'metro' ? G.D.stations[id] : G.stops[id], km = {};
    for (const l of legs) { if (l.type === 'walk') continue; const a = ll(l.type, l.fromId), b = ll(l.type, l.toId); if (!a || !b || !a.lat || !b.lat) continue;
      const op = l.type === 'metro' ? 'GMRC (Metro)' : l.agency === 'AJL' ? 'BRTS (AJL)' : l.agency; km[op] = (km[op] || 0) + M.haversine(a.lat, a.lon, b.lat, b.lon) * 1.3 / 1000; }
    const sum = Object.values(km).reduce((x, y) => x + y, 0); if (!sum || !total) return [];
    return Object.entries(km).map(([operator, k]) => ({ operator, km: Math.round(k * 10) / 10, pct: Math.round(k / sum * 100), inr: Math.round(total * k / sum * 100) / 100 }));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = J; else root.Journey = J;
})(typeof window !== 'undefined' ? window : globalThis);
