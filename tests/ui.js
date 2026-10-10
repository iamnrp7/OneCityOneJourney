// Renders the real index.html + app.js in jsdom, clicks the buttons, prints what the user would see.
const { JSDOM } = require('/tmp/node_modules/jsdom'), fs = require('fs'), root = __dirname + '/../';
(async () => {
  const dom = new JSDOM(fs.readFileSync(root + 'index.html', 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window; w.indexedDB = require('/tmp/node_modules/fake-indexeddb').indexedDB; w.fetch = async u => ({ json: async () => JSON.parse(fs.readFileSync(root + u)) });
  ['lib/metro.js', 'lib/journey.js', 'app.js'].forEach(f => w.eval(fs.readFileSync(root + f, 'utf8')));
  await new Promise(r => setTimeout(r, 1500));
  const txt = () => w.document.querySelector('#out').textContent.replace(/\s+/g, ' ').trim();
  const chips = [...w.document.querySelectorAll('#pre button')]; console.log('chips:', chips.map(c => c.textContent).join(' | '));
  for (const [i, t] of [[2, '10:00'], [2, '00:46'], [1, '10:00'], [3, '10:00'], [4, '00:46']]) {
    if (i === 4) { chips[0].click(); const q = w.document.querySelector('#q-from'); q.value = 'Thaltej'; q.dispatchEvent(new w.Event('input')); [...w.document.querySelectorAll('#r-from button')].find(b => b.textContent === 'Thaltej (Metro)').click(); const q2 = w.document.querySelector('#q-to'); q2.value = 'Sachivalaya'; q2.dispatchEvent(new w.Event('input')); w.document.querySelector('#r-to button').click(); } else if (i === 3) { chips[0].click(); const q = w.document.querySelector('#q-to'); q.value = 'Gandhinagar Kelvani'; q.dispatchEvent(new w.Event('input')); w.document.querySelector('#r-to button').click(); } else chips[i].click();
    w.document.querySelector('#time').value = t; w.document.querySelector('#go').click(); await new Promise(r => setTimeout(r, 50));
    console.log('\n=== chip', i, 'at', t, '\n' + txt().slice(0, 900));
    console.log('metro-only line:', /Metro-only alternative/.test(txt()), '| HAS split block:', /Proposed fare split/.test(txt()), '| known-fares note:', /only the known total/.test(txt()), '| long-walk warning:', /Long walk/.test(txt()), '| long wait:', /Long wait/.test(txt()));
  }
})();

// --- Slice 3: save / list / reopen / delete
(async () => {})();
