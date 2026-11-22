const src = require('fs').readFileSync('g.js','utf8');
const cut = (a,b) => src.slice(src.indexOf(a), src.indexOf(b));
let code = cut("/* ---------- program ---------- */", "/* ---------- render ---------- */") + cut("/* ---------- progression ---------- */", "function advicePanel") + cut("function applyCut", "function advicePanel") + cut("const weeksTxt", "function renderPlan") + cut("/* ---------- stats & charts ---------- */", "function niceMax") + cut("function bodyWeightAt", "function bucketLabel") + cut("const TWINS =", "function renameExercise");
code = code.replace(/^const /gm,'var ').replace(/^let /gm,'var ');
eval(code + `
state.growth = {}; state.dismiss = {}; state.sched = {}; state.scale = {}; state.body = [{date:'2026-10-10', weight:100}];
const sessions = []; let t = parseYmd('2026-10-12'); const N = +(process.argv[2] || 23);
const log = {};
for (let cycle = 1; cycle <= N; cycle++){
  for (let day = 1; day <= 5; day++){
    state.cycle = cycle; state.sessions = sessions.slice().reverse(); state.date = ymd(t); state.tab = String(day);
    const sets = {};
    for (const ex of getDay(String(day), variant(cycle)).ex){
      const sg = suggestFor(ex);
      sets[ex.id] = sg.rows.map(r => ({w: r.w == null ? (/calf/.test(ex.id) ? 60 : 40) : r.w, r: r.r, e: 'ok'}));
      const ph = phaseOf(ex.id, cycle);
      (log[ex.id] = log[ex.id] || {name: ex.name, rows: []}).rows.push({c: cycle, date: state.date, ph, sets: sets[ex.id], T: exVolume(baseId(ex.id), sets[ex.id], state.date)});
    }
    sessions.push({date: ymd(t), day: String(day), cycle, sets});
    t.setDate(t.getDate() + (day === 5 ? 4 : 1));
  }
}
const fmtS = a => a.map(x => fmtW(x.w) + '×' + x.r).join(' · ');
const tag = ph => ph.deload ? 'разгр.' : ph.pos === ph.L ? 'ПИК' : ph.pos + '/' + ph.L;
const DETAIL = process.argv[3];
if (DETAIL){ for (const id of DETAIL.split(',')) { const L = log[id]; console.log('\\n' + L.name + ' (' + id + ')'); for (const r of L.rows) console.log('  МЦ' + String(r.c).padStart(2) + ' ' + dm(r.date) + ' волна ' + r.ph.block + ' ' + tag(r.ph).padEnd(6) + ' ' + fmtS(r.sets).padEnd(44) + Math.round(r.T) + ' кг'); } }
else {
  // per exercise: best (peak) tonnage of each wave, excluding deloads; first vs last wave; is every wave higher?
  console.log('упражнение'.padEnd(40) + 'лучшее за волну (кг)'.padEnd(46) + 'старт → финиш (подход 1)');
  for (const [id, L] of Object.entries(log)){
    const waves = {};
    for (const r of L.rows){ if (r.ph.deload) continue; const b = r.ph.block; if (!waves[b] || r.T > waves[b].T) waves[b] = r; }
    const ks = Object.keys(waves).map(Number).sort((a,b)=>a-b);
    // ignore the last wave if it is not finished yet
    const endBlock = phaseOf(id, N).block; const lastFull = ks.filter(b => b < endBlock || (b === endBlock && phaseOf(id, N).pos >= phaseOf(id, N).L));
    const vals = lastFull.map(b => Math.round(waves[b].T));
    let mono = true; for (let i = 1; i < vals.length; i++) if (vals[i] <= vals[i-1]) mono = false;
    const first = L.rows.find(r => !r.ph.deload), last = [...L.rows].reverse().find(r => !r.ph.deload);
    console.log((L.name.slice(0,30) + ' ' + id).padEnd(40) + (vals.join(' → ') + (mono ? '' : '  ⚠')).padEnd(46) + fmtW(first.sets[0].w) + '×' + first.sets[0].r + ' → ' + fmtW(last.sets[0].w) + '×' + last.sets[0].r + '  (' + Math.round(first.T) + ' → ' + Math.round(last.T) + ' кг)');
  }
}
`);
