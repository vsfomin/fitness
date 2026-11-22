// what the app will suggest next time, from the real records in tools/db
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'g.js'), 'utf8');
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
let code = cut("/* ---------- program ---------- */", "/* ---------- render ---------- */") + cut("/* ---------- progression ---------- */", "function advicePanel") + cut("function applyCut", "function advicePanel") + cut("/* ---------- stats & charts ---------- */", "function niceMax") + cut("function bodyWeightAt", "function bucketLabel") + cut("function suggest(){", "/* ---------- render ---------- */") + cut("/* ---------- layout editor ---------- */", "function renderLayoutEditor") + cut("// added exercises: registered", "function addExercise") + cut("const TWINS =", "function renameExercise");
code = code.replace(/^const /gm, 'var ').replace(/^let /gm, 'var ');
const rd = p => JSON.parse(fs.readFileSync(path.join(__dirname, 'db', p)));
eval(code + `
const sessions = fs.readdirSync(path.join(__dirname, 'db/sessions')).map(f => rd('sessions/' + f)).sort((a, b) => a.date < b.date ? 1 : -1);
const G = rd('settings/growth.json'), LY = rd('settings/layout.json'), NM = rd('settings/names.json');
state.sessions = sessions; state.growth = G.values || {}; state.sched = G.sched || {}; state.scale = G.scale || {}; state.dismiss = G.dismiss || {};
state.layout = LY.days; state.links = LY.links || null; state.extra = LY.extra || {}; state.deloadOv = LY.deloadOv || {}; state.setsDelta = LY.setsDelta || {}; state.hidden = LY.hidden || {}; state.wStep = LY.wStep || {};
state.names = NM.names || {}; state.body = [{date: '2026-10-10', weight: 100}]; registerExtras();
const fmt = rs => rs.map(r => (r.w == null ? '?' : fmtW(r.w)) + '×' + r.r).join(' · ');
for (const [day, date, cyc] of JSON.parse(process.argv[2])){
  state.date = date; state.cycle = cyc; state.tab = day;
  console.log('\\nДЕНЬ ' + day + ' · ' + dm(date) + ' · МЦ ' + cyc);
  for (const ex of getDay(day, variant(cyc)).ex){
    const sg = suggestFor(ex), p = prevSessionsFor(ex.id, 1)[0], ph = phaseOf(ex.id, cyc);
    const last = p ? fmt(p.sets.filter(x => x && x.r != null)) + p.sets.filter(x => x && x.r != null).map(x => x.e === 'easy' ? '+' : x.e === 'fail' ? '✕' : '').join('') : '—';
    console.log('  ' + (ex.n + ' ' + nameOf(ex)).padEnd(40) + ('[' + (ph.deload ? 'разгр' : ph.hold ? 'держ' : ph.pos + '/' + ph.L) + ']').padEnd(9) + 'было: ' + last.padEnd(42) + ' → ' + fmt(sg.rows) + (sg.chip ? '  (' + sg.chip.text + ')' : ''));
  }
}
`);
