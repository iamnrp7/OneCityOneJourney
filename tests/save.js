const { JSDOM } = require('/tmp/node_modules/jsdom'), fs = require('fs'), root = __dirname + '/../';
(async () => {
  const dom = new JSDOM(fs.readFileSync(root + 'index.html', 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window; w.indexedDB = require('/tmp/node_modules/fake-indexeddb').indexedDB; w.scrollTo = () => {}; w.fetch = async u => ({ json: async () => JSON.parse(fs.readFileSync(root + u)) });
  ['lib/metro.js', 'lib/journey.js', 'app.js'].forEach(f => w.eval(fs.readFileSync(root + f, 'utf8')));
  const d = w.document, wait = ms => new Promise(r => setTimeout(r, ms)), txt = s => d.querySelector(s).textContent.replace(/\s+/g, ' ').trim();
  await wait(1200);
  d.querySelectorAll('#pre button')[2].click(); await wait(100);
  console.log('save button present:', !!d.querySelector('#save'));
  d.querySelector('#save').click(); await wait(200);
  console.log('saved list:', txt('#saved').slice(0, 160));
  d.querySelector('#out').innerHTML = ''; d.querySelector('[data-open]').click(); await wait(50);
  console.log('reopened card:', /Saved card, shown as stored/.test(txt('#out')), '| has legs:', /BRTS 12U-RL/.test(txt('#out')), '| has split:', /Proposed fare split/.test(txt('#out')), '| save button hidden:', !d.querySelector('#save'));
  d.querySelector('[data-del]').click(); await wait(200);
  console.log('after delete, saved list empty:', txt('#saved') === '');
})();
