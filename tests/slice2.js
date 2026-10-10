const J=require('../lib/journey.js'),M=require('../lib/metro.js');
(async()=>{await J.load(__dirname+'/../data/');
const sola=J.search('Sola Bhagwat').find(x=>x.key[0]==='B');
for(const [a,b,t] of [['M:ranip',sola.key,'10:00'],['M:thaltej-gam','M:sachivalaya','10:00'],['M:ranip','M:gnlu','10:00']]){const r=J.plan(a,b,M.toMin(t));console.log(a,'->',b,r.error||r.minutes+'min',r.longWalk,JSON.stringify(r.fare&&r.fare.total),JSON.stringify(r.legs&&J.split(r.legs,r.fare.total)));}})();
