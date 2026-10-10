/* Metro Hacks helper library. No dependencies. Works in the browser (global `Metro`) and in Node (require).
   Times are minutes after midnight unless a function says otherwise. Station ids are in data/stations.json. */
(function (root) {
  const Metro = {}; let D = null;
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const toStr = m => { m = Math.round(m); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  Metro.toMin = toMin; Metro.toStr = toStr;

  // Load everything. base = folder holding the JSON files (browser: 'data/', node: path with trailing slash)
  Metro.load = async function (base = 'data/') {
    const get = (typeof window !== 'undefined' && typeof fetch === 'function')
      ? async n => (await fetch(base + n)).json()
      : async n => JSON.parse(require('fs').readFileSync(base + n, 'utf8'));
    const [st, tt, nb, dp, fr, sv, br] = await Promise.all(['stations.json', 'timetable_trips.json', 'bus_near_metro.json', 'bus_departures_near_metro.json', 'brts_fares.json', 'service_rules.json', 'bus_routes.json'].map(get));
    D = { corr: st.corridors, stations: Object.fromEntries(st.stations.map(s => [s.id, s])), trips: tt.trips, near: nb.near, deps: dp.stops, fares: fr, rules: sv, routes: br.routes };
    D.byId = Object.fromEntries(D.trips.map(t => [t.id, t]));
    D.stopArea = {}; fr.areas.forEach((a, i) => a.stop_ids.forEach(s => D.stopArea[s] = i));
    return D;
  };
  Metro.data = () => D;
  Metro.haversine = (a, b, c, d) => { const p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };
  Metro.name = id => (D.stations[id] || {}).name || id;

  // ---- Metro timetable: all stations on a trip's path, times at non-timing stations are interpolated (estimated:true)
  function pathOf(t) {
    const NS = D.corr.NS, ia = NS.indexOf('apmc'), ig = NS.indexOf('gnlu'), im = NS.indexOf('mahatma-mandir');
    const p = t.pattern === 'gift_city_branch' ? NS.slice(ia, ig + 1).concat(['pdeu', 'gift-city']) : NS.slice(ia, im + 1);
    return t.direction === 'north' ? p : p.slice().reverse();
  }
  function timesAlong(t) {
    if (t._tm) return t._tm;
    const p = pathOf(t), known = {}; t.stops.forEach(s => known[s.station] = toMin(s.time));
    const out = p.map(s => ({ station: s, min: null, estimated: true })), idx = [];
    p.forEach((s, i) => { if (known[s] !== undefined) { out[i].min = known[s]; out[i].estimated = false; idx.push(i); } });
    for (let k = 0; k + 1 < idx.length; k++) { const a = idx[k], b = idx[k + 1]; for (let i = a + 1; i < b; i++) out[i].min = known[p[a]] + (known[p[b]] - known[p[a]]) * (i - a) / (b - a); }
    return (t._tm = out);
  }
  Metro.tripTimes = id => timesAlong(D.byId[id]);
  // Next metro options between two stations on the NS / GIFT City corridor (East-West line has no trip-level timetable)
  Metro.journeys = function (from, to, after, n = 3) {
    const res = [];
    for (const t of D.trips) {
      const tm = timesAlong(t), i = tm.findIndex(x => x.station === from), j = tm.findIndex(x => x.station === to);
      if (i < 0 || j <= i || tm[i].min < after) continue;
      res.push({ trip: t.id, depart: Math.round(tm[i].min), arrive: Math.round(tm[j].min), minutes: Math.round(tm[j].min - tm[i].min), stops: j - i, estimated: tm[i].estimated || tm[j].estimated, pattern: t.pattern });
    }
    return res.sort((a, b) => a.depart - b.depart).slice(0, n);
  };
  Metro.stationsAhead = (tripId, from) => { const tm = timesAlong(D.byId[tripId]), i = tm.findIndex(x => x.station === from); return i < 0 ? [] : tm.slice(i); };

  // ---- Bus: last mile and "will I make my bus"
  Metro.nearbyBus = id => D.near[id] || [];
  // arriveMin = minute the metro arrives; returns upcoming bus options after walking to each nearby stop
  Metro.connect = function (stationId, arriveMin, o = {}) {
    const speed = o.walkMetersPerMin || 75, detour = o.detour || 1.3, near = (D.near[stationId] || []).slice(0, o.maxStops || 4), options = [];
    for (const s of near) {
      const walk = Math.ceil(s.dist_m * detour / speed), ready = arriveMin + walk;
      for (const ser of (D.deps[s.stop_id] || [])) {
        const nx = ser.times.find(t => t >= ready);
        if (nx !== undefined) options.push({ stop_id: s.stop_id, stop: s.name, dist_m: s.dist_m, walk_min: walk, route: ser.route, agency: ser.agency, headsign: ser.headsign, departs: nx, wait_min: nx - ready, tight: nx - ready <= 2 });
      }
    }
    options.sort((a, b) => a.departs - b.departs);
    return { options: options.slice(0, o.limit || 8), nearest_m: near[0] ? near[0].dist_m : null, gap: !near.length || near[0].dist_m > 400 };
  };
  Metro.brtsFare = function (stopA, stopB, child) {
    const a = D.stopArea[stopA], b = D.stopArea[stopB]; if (a === undefined || b === undefined) return null;
    const v = (child ? D.fares.child : D.fares.adult)[a][b]; return v || null;
  };

  // ---- Operations: rake rotation (ASSUMED, not published) and delay propagation
  // A train arriving at a terminal is assumed to form the next departure from that terminal after `turnback` minutes.
  Metro.rakeChains = function (turnback = 5) {
    const arr = [], dep = [];
    for (const t of D.trips) { dep.push({ id: t.id, st: t.origin, m: toMin(t.stops[0].time) }); arr.push({ id: t.id, st: t.destination, m: toMin(t.stops[t.stops.length - 1].time) }); }
    arr.sort((a, b) => a.m - b.m);
    const next = {}, prev = {}, used = new Set();
    for (const a of arr) {
      const c = dep.filter(x => x.st === a.st && !used.has(x.id) && x.m >= a.m + turnback).sort((x, y) => x.m - y.m)[0];
      if (c) { next[a.id] = c.id; prev[c.id] = a.id; used.add(c.id); }
    }
    return { next, prev, rakes: D.trips.filter(t => !prev[t.id]).length };
  };
  Metro.minHeadway = function () { // smallest scheduled gap between consecutive same-direction trains at any timing point
    const last = {}; let min = 999;
    for (const t of D.trips.slice().sort((a, b) => toMin(a.stops[0].time) - toMin(b.stops[0].time))) for (const s of t.stops) {
      const k = t.direction + '|' + s.station, m = toMin(s.time); if (last[k] !== undefined && m > last[k]) min = Math.min(min, m - last[k]); last[k] = Math.max(last[k] || 0, m);
    }
    return min;
  };
  // Inject `delayMin` into a trip at a station; returns every trip that ends up late and why.
  // Model (assumptions, tune in the UI): delay shrinks by `recover` min per timing segment; a train may not run
  // closer than `hmin` min behind the previous scheduled train at a station; a rake leaves its terminal no earlier
  // than it arrived + `turnback` min.
  Metro.simulateDelay = function ({ tripId, stationId, delayMin, recover = 1, hmin = 3, turnback = 5 }) {
    const { prev } = Metro.rakeChains(turnback), byKey = {}, predAt = {}, res = {}, busy = {};
    D.trips.forEach(t => t.stops.forEach(s => (byKey[t.direction + '|' + s.station] = byKey[t.direction + '|' + s.station] || []).push({ id: t.id, m: toMin(s.time) })));
    Object.entries(byKey).forEach(([k, a]) => { a.sort((x, y) => x.m - y.m); a.forEach((e, i) => predAt[k + '|' + e.id] = i ? a[i - 1].id : null); });
    function run(id) {
      if (res[id]) return res[id]; if (busy[id]) return null; busy[id] = 1;
      const t = D.byId[id], at = {}; let carry = 0, cause = null, max = 0, d = 0;
      const p = prev[id], r0 = p ? run(p) : null;
      if (r0) { const pt = D.byId[p], need = toMin(pt.stops[pt.stops.length - 1].time) + r0.arr + turnback - toMin(t.stops[0].time); if (need > 0) { carry = need; cause = 'rake from ' + p; } }
      for (const s of t.stops) {
        const sched = toMin(s.time), lk = t.direction + '|' + s.station; d = carry;
        if (id === tripId && s.station === stationId) { d = Math.max(d, delayMin); if (delayMin > 0) cause = 'injected'; }
        const pr = predAt[lk + '|' + id], rp = pr ? run(pr) : null;
        if (rp && rp.at[s.station] !== undefined && sched + d < rp.at[s.station] + hmin) { d = rp.at[s.station] + hmin - sched; cause = cause || 'headway behind ' + pr; }
        at[s.station] = sched + d; max = Math.max(max, d); carry = Math.max(0, d - recover);
      }
      return (res[id] = { arr: d, max, cause, at });
    }
    const out = [];
    for (const t of D.trips) { const r = run(t.id); if (r && r.max >= 1) out.push({ trip: t.id, direction: t.direction, from: t.origin, depart: toMin(t.stops[0].time), max_delay: Math.round(r.max), arrival_delay: Math.round(r.arr), cause: r.cause }); }
    return out.sort((a, b) => a.depart - b.depart);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Metro; else root.Metro = Metro;
})(typeof window !== 'undefined' ? window : globalThis);
