const J = require('../lib/journey.js'), M = require('../lib/metro.js');
(async () => {
  console.time('load'); await J.load(__dirname + '/../data/'); console.timeEnd('load');
  const show = (a, b, t) => { console.time('plan'); const r = J.plan(a, b, M.toMin(t)); console.timeEnd('plan');
    console.log('\n' + (r.from ? r.from.name : a) + ' -> ' + (r.to ? r.to.name : b) + ' @' + t);
    if (r.error) return console.log(r);
    r.legs.forEach(l => console.log(' ', l.type.padEnd(5), M.toStr(l.dep), M.toStr(l.arr), (l.route || l.line || '') + ' ' + l.from + ' > ' + l.to, l.stops ? l.stops + ' stops' : (l.dist || '') + 'm', l.basis || ''));
    console.log('  arrive', M.toStr(r.arrive), r.minutes + ' min', JSON.stringify(r.fare)); };
  show('M:thaltej-gam', 'M:sachivalaya', '10:00');
  show('M:apmc', 'M:old-high-court', '10:00');
  show('M:vastral-gam', 'M:gnlu', '09:00');
  show('M:mahatma-mandir', 'M:apmc', '16:00');
  const s = J.search('ranip'); console.log(s.slice(0, 4).map(x => x.name));
  const b = J.search('Sola'); console.log(b.slice(0, 4).map(x => x.name));
  show('M:ranip', b[b.length-1].key, '10:00');
})();
