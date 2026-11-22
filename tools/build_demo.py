import re
s = open('/Users/user/fitness/gym.html').read()
demo_js = r'''
/* ---------- TEST PAGE: simulated half year, two scenarios ---------- */
function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SCENARIOS = {
  ideal: {title: 'Всё по плану', changes: {}, ideal: true},
  base: {title: 'Без изменений', changes: {}},
  edit: {title: 'С изменениями', changes: {
    3: [['len', 'g:quad', 8], ['len', 'g:hams', 8], ['len', 'g:calf', 8], ['growth', 'quad', 10], ['growth', 'hams', 10]],
    10: [['growth', 'chest', 3]],
    12: [['own', 'd2_incl', 7]],
  }},
};
const LOG = [];
function applyChange(ch){
  const [kind, a, b] = ch;
  if (kind === 'len'){ setLen(a, b); LOG.push(`МЦ ${state.cycle}: ${GROUPS.find(g => g.k === a.slice(2)).name} — пик на ${b}-м микроцикле волны`); }
  if (kind === 'growth'){ state.growth = {...state.growth, [a]: b}; LOG.push(`МЦ ${state.cycle}: ${GROUPS.find(g => g.k === a).name} — рост ${b}%`); }
  if (kind === 'own'){ const gk = 'g:' + GROUP_OF[a]; state.sched = {...state.sched, ['x:' + a]: {L: schedOf(gk).L, blocks: blocksUpTo(gk, state.cycle)}}; setLen('x:' + a, b); LOG.push(`МЦ ${state.cycle}: ${CATALOG[a].name} — своя волна, пик на ${b}-м`); }
}
function genDemo(scn){
  const rnd = mulberry32(42), noise = a => (rnd() - 0.5) * 2 * a;
  state.growth = {}; state.dismiss = {}; state.sched = {}; state.scale = {}; LOG.length = 0;
  const sessions = [], body = [], nutr = [], cap = {};
  const startT = parseYmd('2026-10-12'), endT = parseYmd(DEMO_TODAY);
  let t = new Date(startT), cycle = 1;
  const changes = SCENARIOS[scn].changes;
  while (t <= endT){
    state.cycle = cycle; state.sessions = sessions.slice().reverse(); state.date = ymd(t); state.tab = 'x';
    for (const ch of changes[cycle] || []) applyChange(ch);
    // the simulated person accepts the app's suggestion to lower a goal
    for (const ad of groupAdvice()) if (ad.dir === 'down'){ applyCut(ad); LOG.push(`МЦ ${cycle}: «${ad.name}» на ${ad.gap}% ниже плана — приложение предложило снизить объём волны на ${ad.cut}%, принято`); }
    for (let day = 1; day <= 5 && t <= endT; day++){
      const v = variant(cycle), key = String(day);
      state.sessions = sessions.slice().reverse(); state.date = ymd(t); state.tab = key; state.cycle = cycle;
      const sets = {}, plan = {};
      getDay(key, v).ex.forEach(ex => {
        const sg = suggestFor(ex);
        plan[ex.id] = {T: Math.round(sg.planT || 0), w: Math.max(0, ...sg.rows.map(x => x.w || 0)), s: sg.rows.map(x => [x.w, x.r])};
        // a real strength limit per exercise (Epley e1RM) that grows ~0.5% a week: the plan is done only when possible
        const bwE = ex.bw ? bodyWeightAt(state.date) : 0;
        if (SCENARIOS[scn].ideal){ sets[ex.id] = sg.rows.map(s => ({w: s.w == null ? (/calf/.test(ex.id) ? 60 : 40) : s.w, r: s.r, e: 'ok'})); return; }
        sets[ex.id] = sg.rows.map((s, j) => {
          let w = s.w;
          if (w == null) w = /calf/.test(ex.id) ? 60 : /hip/.test(ex.id) ? 120 : 40;
          if (cap[ex.id] == null) cap[ex.id] = (w + bwE) * (1 + (s.hi + 2) / 30);
          const weeks = (t - startT) / (7 * DAY_MS);
          const can = Math.floor(30 * (cap[ex.id] * (1 + 0.005 * weeks) / (w + bwE) - 1) - 1 - 0.4 * j + noise(0.8));
          const r = Math.max(1, Math.min(s.r + (rnd() > 0.85 ? 1 : 0), can, s.hi));
          return {w, r, e: r < s.r || can <= r ? 'fail' : 'ok'};
        });
      });
      sessions.push({date: ymd(t), day: key, cycle, sets, plan});
      t.setDate(t.getDate() + (rnd() < 0.6 ? 2 : 1));
    }
    cycle++;
  }
  const trainDays = new Set(sessions.map(d => d.date));
  for (let d = new Date(startT), i = 0; d <= endT; d.setDate(d.getDate() + 1), i++){
    const date = ymd(d);
    if (rnd() < 0.85) body.push({date, weight: Math.round((100 - 0.034 * i + noise(0.45)) * 10) / 10, waist: d.getDay() === 1 ? Math.round((88 - 0.022 * i + noise(0.3)) * 10) / 10 : null});
    if (rnd() < 0.8){
      const train = trainDays.has(date), tg = TARGETS[train ? 'train' : 'rest'];
      const protein = Math.round(tg.protein + noise(18)), fat = Math.round(tg.fat + noise(12)), carbs = Math.round(tg.carbs + noise(35));
      const kcal = protein * 4 + fat * 9 + carbs * 4;
      const off = Math.max(...['kcal','protein','fat','carbs'].map(k => Math.abs(({kcal, protein, fat, carbs})[k] - tg[k]) / tg[k]));
      nutr.push({date, type: train ? 'train' : 'rest', kcal, protein, fat, carbs, sat_fat: Math.round(10 + noise(5)), fiber: Math.round(32 + noise(8)), meals: [], verdict: off <= 0.07 ? 'good' : off <= 0.15 ? 'ok' : 'off', summary: 'Пример разбора: смоделированные данные.', tips: [], unreadable: false});
    }
  }
  state.sessions = sessions.reverse(); state.body = body.reverse(); state.nutr = nutr.reverse();
  state.date = DEMO_TODAY;
  state.cycle = suggest().cycle;
}
let SCN = 'base';
function showScenario(k){
  SCN = k; const keepTab = state.tab; genDemo(k); state.tab = keepTab;
  document.querySelectorAll('#scn button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
  $('#scnlog').textContent = k === 'ideal' ? 'Каждая тренировка выполнена точно по предложению приложения. Данные — с 12.10.2026 по 10.04.2027, дальше — план.' : LOG.length ? LOG.join(' · ') : 'Человек ничего не меняет: длина волн и проценты по умолчанию.';
  $('#date').value = state.date;
  render();
}
document.querySelectorAll('#scn button').forEach(b => b.onclick = () => showScenario(b.dataset.k));
state.tab = 'stats'; state.range = 'custom'; state.cFrom = '2026-10-12'; state.cTo = '2027-06-30'; state.exSel = 'd1_hack';
showScenario('ideal');
setStatus('тест');
'''
lines = s.split('\n'); idx = lines.index('render();', 900)
endl = max(i for i,l in enumerate(lines) if l.strip() == '</script>')
lines[idx:endl] = demo_js.split('\n'); t = '\n'.join(lines)
banner = '''<div class="banner" style="margin-top:12px;display:flex;flex-direction:column;gap:8px"><div><b>Тестовая страница.</b> Полгода смоделированных тренировок по программе (12.10.2026 – 10.04.2027). «Всё по плану» — человек выполняет ровно то, что предложило приложение, во всех упражнениях. «Реально» — у него есть предел силы (+0,5% в неделю), план выполняется не всегда. «С изменениями» — он меняет длину волн и проценты по ходу. Ничего не сохраняется.</div>
    <div class="seg" id="scn" role="group" aria-label="Сценарий" style="flex-wrap:wrap"><button type="button" data-k="ideal" aria-pressed="true">Всё по плану</button><button type="button" data-k="base" aria-pressed="false">Реально</button><button type="button" data-k="edit" aria-pressed="false">С изменениями</button></div>
    <div class="note" id="scnlog" style="color:var(--fg)"></div></div>'''
for x,y in [
 ("date: ymd(new Date()), tab:'1', cycle:1,", "date: DEMO_TODAY, tab:'1', cycle:1,"),
 ("const TODAY = () => ymd(new Date());", "const TODAY = () => DEMO_TODAY;"),
 ("/* ---------- program ---------- */", "const DEMO_TODAY = '2027-04-10';\n/* ---------- program ---------- */"),
 ("<title>Тренировочный план</title>", "<title>Тренировочный план: тест</title>"),
 ('<div class="wrap">', '<div class="wrap">\n  ' + banner),
]:
    assert t.count(x)==1, x; t = t.replace(x,y)
open('/Users/user/fitness/gym-demo.html','w').write(t)
open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'd.js'),'w').write(re.search(r'<script>(.*)</script>',t,re.S).group(1))
t=open('/Users/user/fitness/gym-demo.html').read().replace('<title>Тренировочный план: тест</title>','<title>Тест плана</title>')
open('/Users/user/fitness/gym-demo.html','w').write(t)
print('demo built')
