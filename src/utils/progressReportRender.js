import { SCIENCE_LANDMARK_COLORS } from './sciencePlanning';
import { drawProgressMuscle, progressReportPalette } from './progressReportStyle';
import { locale, tr } from '../i18n';

const WIDTH = 1080, HEIGHT = 1440, PAD = 64;
const fmt = (value, digits = 0) => Number(value).toLocaleString(locale(), { maximumFractionDigits: digits });
const date = time => new Date(time).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: '2-digit' });
const chunks = (items, count) => Array.from({ length: Math.ceil(items.length / count) }, (_, i) => items.slice(i * count, (i + 1) * count));

export function progressReportPages(report) {
  const pages = [{ type: 'summary', title: tr('Il mio percorso') }];
  const groups = new Map();
  report.exercises.forEach(ex => {
    const name = ex.group || 'Altri esercizi';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(ex);
  });
  for (const [group, exercises] of groups) {
    chunks(exercises, 2).forEach(items => pages.push({ type: 'exercises', title: tr('{group} · esercizi', { group: tr(group) }), group, items }));
  }
  if (report.weight?.length) pages.push({ type: 'weight', title: tr('Andamento del peso') });
  if (report.science) for (const week of report.science.weeks || [report.science]) chunks(week.rows, 12).forEach(items => pages.push({ type: 'science', title: tr('Scienza · settimana {week}', { week: week.week }), week, items }));
  return pages;
}

function reportPainter(C) {
function text(ctx, value, x, y, size = 20, color = C.text, weight = 500, align = 'left') {
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(String(value), x, y); ctx.textAlign = 'left';
}
function card(ctx, x, y, width, height, color = C.panel) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, C.minimal ? 14 : 24); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
}
function bar(ctx, x, y, width, value, max, color = C.cyan, height = 10) {
  ctx.fillStyle = C.border; ctx.beginPath(); ctx.roundRect(x, y, width, height, height / 2); ctx.fill();
  if (value > 0 && max > 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, Math.min(width, width * value / max), height, height / 2); ctx.fill(); }
}
function wrapped(ctx, value, x, y, maxWidth, size = 20, color = C.muted, lineHeight = 30, weight = 500) {
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  const words = String(value).split(/\s+/), lines = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((part, i) => text(ctx, part, x, y + i * lineHeight, size, color, weight));
  return y + lines.length * lineHeight;
}
function chart(ctx, points, x, y, width, height, { color = C.cyan, bars = false, unit = '', baseline = 0, valueKey = 'value' } = {}) {
  if (!points.length) { text(ctx, 'I dati compariranno dopo i primi allenamenti.', x, y + height / 2, 20, C.muted); return; }
  const values = points.map(p => p[valueKey]);
  const min = baseline, max = Math.max(min + 1, ...values) * 1.08;
  const left = x + 64, right = x + width - 12, top = y + 12, bottom = y + height - 40;
  for (let i = 0; i <= 3; i++) {
    const py = top + (bottom - top) * i / 3;
    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
    text(ctx, fmt(max - (max - min) * i / 3, unit === 'kg' ? 1 : 0), left - 14, py + 6, 16, C.muted, 500, 'right');
  }
  const start = points[0].time, duration = Math.max(1, points.at(-1).time - start);
  const coords = points.map((p, i) => ({ x: bars ? left + (right - left) * (i + 0.5) / points.length : points.length === 1 ? (left + right) / 2 : left + (right - left) * (p.time - start) / duration, y: bottom - (bottom - top) * (p[valueKey] - min) / (max - min) }));
  if (bars) {
    const bw = Math.max(1, Math.min(36, (right - left) / points.length * 0.65));
    ctx.fillStyle = color;
    coords.forEach(p => ctx.fillRect(p.x - bw / 2, p.y, bw, Math.max(1, bottom - p.y)));
  } else {
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); coords.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    [coords[0], ...(coords.length > 1 ? [coords.at(-1)] : [])].forEach(p => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); });
  }
  text(ctx, date(start), left, bottom + 30, 15, C.muted);
  if (points.length > 1) text(ctx, date(points.at(-1).time), right, bottom + 30, 15, C.muted, 500, 'right');
}
function header(ctx, report, page, index, total) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(WIDTH * .65, 0, 0, WIDTH * .65, 0, 740);
  glow.addColorStop(0, `rgba(${C.glow},${C.minimal ? .12 : .2})`); glow.addColorStop(1, `rgba(${C.glow},0)`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawProgressMuscle(ctx, page.group || '', WIDTH - PAD - 118, 85, 112, 150, C);
  text(ctx, 'ELITEJIM', PAD, 78, 26, C.cyan, 900);
  text(ctx, report.demo ? 'DEMO' : C.minimal ? 'SCIENCE V3 EDITION' : 'OG ELITE JIM', WIDTH - PAD, 78, 15, C.muted, 750, 'right');
  wrapped(ctx, page.title, PAD, 154, WIDTH - PAD * 2 - 160, 43, C.text, 51, 900);
  text(ctx, report.period, PAD, 204, 17, C.muted);
  ctx.strokeStyle = C.border; ctx.beginPath(); ctx.moveTo(PAD, HEIGHT - 80); ctx.lineTo(WIDTH - PAD, HEIGHT - 80); ctx.stroke();
  text(ctx, tr('Report del {date} · tutti i dati registrati', { date: date(report.generatedAt) }), PAD, HEIGHT - 42, 15, C.muted);
  text(ctx, `${index + 1} / ${total}`, WIDTH - PAD, HEIGHT - 42, 16, C.muted, 600, 'right');
}
function summary(ctx, report) {
  const t = report.totals;
  const rankColor = C.minimal ? C.yellow : report.rank.color;
  text(ctx, report.rank.title, PAD, 256, 24, rankColor, 800);
  text(ctx, `${fmt(t.xp)} XP`, WIDTH - PAD, 256, 21, C.muted, 650, 'right');
  bar(ctx, PAD, 278, WIDTH - PAD * 2, report.rank.progress, 100, rankColor, 8);
  const metrics = [[t.workouts, tr('ALLENAMENTI')], [t.completedSets, tr('SERIE REGISTRATE')], [t.prCount, tr('RECORD BATTUTI')], [t.overloadRate == null ? '—' : `${t.overloadRate}%`, tr('SEDUTE IN OVERLOAD')], [tr('{n} sett.', { n: t.currentStreak }), tr('STREAK ATTUALE')], [tr('{n} sett.', { n: t.highestStreak }), tr('STREAK MIGLIORE')]];
  metrics.forEach(([value, label], i) => {
    const x = PAD + i % 3 * 324, y = 322 + Math.floor(i / 3) * 156;
    card(ctx, x, y, 304, 136); text(ctx, typeof value === 'number' ? fmt(value) : value, x + 22, y + 64, 36, C.text, 850); text(ctx, label, x + 22, y + 105, 14, C.muted, 700);
  });
  text(ctx, tr('La continuità, nel tempo'), PAD, 716, 28, C.text, 800);
  text(ctx, tr('Serie registrate per {period} · intero storico', { period: tr(report.activity.granularity) }), PAD, 752, 18, C.muted);
  chart(ctx, report.activity.points, PAD, 782, WIDTH - PAD * 2, 290, { bars: true, valueKey: 'sets' });
  text(ctx, tr('{n} ripetizioni', { n: fmt(t.repetitions) }), PAD, 1136, 24, C.cyan, 750);
  text(ctx, tr('{n} ore registrate', { n: fmt(t.minutes / 60, 1) }), WIDTH - PAD, 1136, 24, C.cyan, 750, 'right');
  text(ctx, tr('{n} t di carico esterno registrato', { n: fmt(t.externalKg / 1000, 1) }), PAD, 1180, 19, C.muted);
  wrapped(ctx, tr('{n} esercizi nel dettaglio nelle pagine successive. Totali e record seguono le formule dell’app; le serie registrate includono le tecniche di intensità.', { n: report.exercises.length }), PAD, 1240, WIDTH - PAD * 2, 17, C.muted, 26);
}
function science(ctx, report, page) {
  const estimated = page.week.kind === 'estimate' || page.week.kind === 'deload-estimate';
  text(ctx, `${tr(page.week.phase)} · ${report.science.accounting === 'legacy' ? tr('conteggi originali') : tr('serie dirette completate')}`, PAD, 250, 18, C.muted);
  page.items.forEach((m, i) => {
    const y = 328 + i * 76;
    const color = SCIENCE_LANDMARK_COLORS[m.band] || C.cyan;
    text(ctx, tr(m.name), PAD, y, 23, C.text, 700);
    if (m.focus) text(ctx, 'FOCUS', PAD + 240, y, 13, color, 850);
    text(ctx, estimated ? tr('{n} serie · stima', { n: m.target }) : tr('{done} / {n} serie', { done: m.done, n: m.target }), WIDTH - PAD, y, 20, color, 750, 'right');
    const peak = estimated ? Math.max(1, ...(report.science.weeks || [page.week]).flatMap(w => w.rows.filter(row => row.name === m.name).map(row => row.target))) : Math.max(1, m.target);
    bar(ctx, PAD, y + 20, WIDTH - PAD * 2, estimated ? m.target : m.done, peak, color, 8);
    if (m.imported || m.unknown) text(ctx, [m.imported ? tr(m.imported === 1 ? '{n} riportata da V2' : '{n} riportate da V2', { n: m.imported }) : '', m.unknown ? tr('{n} senza RIR', { n: m.unknown }) : ''].filter(Boolean).join(' · '), PAD, y + 48, 13, C.yellow);
  });
  wrapped(ctx, page.week.kind === 'estimate' || page.week.kind === 'deload-estimate' ? tr('Proiezione: gli obiettivi potranno cambiare in base a qualità, recupero e scelte dell’atleta. Nessuna serie futura è già completata.') : report.science.accounting === 'legacy' ? tr('Conteggi storici del protocollo conservati. Scienza V3.0 modifica solo le proposte accettate.') : tr('Le serie riportate da V2 conservano il progresso senza inventare il RIR. Anche le serie senza RIR contano; riscaldamento e tecniche sono esclusi.'), PAD, 1268, WIDTH - PAD * 2, 15, C.muted, 23);
}
function exercise(ctx, ex, y) {
  card(ctx, PAD, y, WIDTH - PAD * 2, 500);
  const x = PAD + 28, width = WIDTH - PAD * 2 - 56;
  wrapped(ctx, ex.name, x, y + 47, width - 170, 25, C.text, 31, 800);
  if (!ex.points.length) { wrapped(ctx, tr('{n} serie registrate. Non ci sono ancora serie ordinarie confrontabili per tracciare la progressione di questo esercizio. Le tecniche di intensità e il riscaldamento restano nei totali dello storico.', { n: ex.registeredSets }), x, y + 150, width, 21, C.muted, 35); return; }
  const label = ex.metric === 'estimated' ? tr('1RM stimato · carico esterno') : tr('Ripetizioni sulla serie migliore');
  text(ctx, label, x, y + 110, 16, C.muted);
  const delta = ex.deltaPercent == null ? (ex.points.length === 1 ? tr('1 osservazione') : tr('{n} osservazioni', { n: ex.points.length })) : `${ex.deltaPercent > 0 ? '+' : ''}${fmt(ex.deltaPercent, 1)}%`;
  text(ctx, delta, WIDTH - PAD - 28, y + 48, 22, ex.deltaPercent < 0 ? C.red : C.green, 800, 'right');
  text(ctx, `${fmt(ex.first.value, 1)} → ${fmt(ex.latest.value, 1)} ${ex.unit}`, x, y + 158, 29, C.text, 800);
  text(ctx, tr('Prima → ultima osservazione'), x, y + 188, 15, C.muted);
  chart(ctx, ex.points, x, y + 213, width, 215, { unit: ex.unit });
  const top = ex.best.kg > 0 ? `${fmt(ex.best.kg, 1)} kg × ${fmt(ex.best.reps)} rep` : tr('{n} rep a corpo libero / carico nullo', { n: fmt(ex.best.reps) });
  text(ctx, tr('Serie di riferimento: {set}', { set: top }), x, y + 462, 16, C.muted);
}
function weight(ctx, report) {
  const values = report.weight, first = values[0], last = values.at(-1);
  text(ctx, tr('Pesate del Diario · incluse su tua scelta'), PAD, 260, 20, C.muted);
  const metrics = [[first.value, tr('PRIMA PESATA')], [last.value, tr('ULTIMA PESATA')], [last.value - first.value, tr('VARIAZIONE KG')]];
  metrics.forEach(([v, label], i) => { const x = PAD + i * 324; card(ctx, x, 308, 304, 138); text(ctx, `${fmt(v, 1)}${i < 2 ? ' kg' : ''}`, x + 22, 374, 34, C.text, 850); text(ctx, label, x + 22, 414, 15, C.muted); });
  chart(ctx, values, PAD, 516, WIDTH - PAD * 2, 480, { unit: 'kg', baseline: Math.max(0, Math.floor(Math.min(...values.map(p => p.value)) - 1)) });
  wrapped(ctx, tr('La variazione del peso non misura da sola la crescita muscolare. Il grafico mostra tutte le pesate registrate e non interpreta una fase di massa o definizione.'), PAD, 1090, WIDTH - PAD * 2, 20, C.muted, 34);
}

function exercisePage(ctx, page) {
  page.items.forEach((ex, j) => exercise(ctx, ex, 244 + j * 526));
  text(ctx, tr('Stime, non massimali testati. Serie ordinarie; a corpo libero, carico esterno aggiunto.'), PAD, 1295, 15, C.muted);
}
return { header, summary, science, exercisePage, weight };
}

export async function renderProgressReport(report, { signal } = {}) {
  const { jsPDF } = await import('jspdf');
  await document.fonts?.ready;
  const pages = progressReportPages(report), images = [];
  const { header, summary, science, exercisePage, weight } = reportPainter(progressReportPalette(report.theme, report.scienceGlow));
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(tr('Impossibile creare il report su questo browser.'));
  const pdf = new jsPDF({ unit: 'px', format: [WIDTH, HEIGHT], orientation: 'portrait', compress: true, hotfixes: ['px_scaling'] });
  pdf.setProperties({ title: tr('EliteJIM - Progressi completi'), creator: 'EliteJIM', subject: tr('Riepilogo e progressione di tutti gli esercizi registrati') });
  let summaryPng = null;
  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) throw new DOMException('Report annullato', 'AbortError');
    const page = pages[i]; header(ctx, report, page, i, pages.length);
    if (page.type === 'summary') summary(ctx, report);
    else if (page.type === 'science') science(ctx, report, page);
    else if (page.type === 'weight') weight(ctx, report);
    else exercisePage(ctx, page);
    if (i === 0) summaryPng = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const image = canvas.toDataURL('image/jpeg', 0.9); images.push(image);
    if (i > 0) pdf.addPage([WIDTH, HEIGHT], 'portrait');
    pdf.addImage(image, 'JPEG', 0, 0, WIDTH, HEIGHT, undefined, 'FAST');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { images, pages, pdfBlob: pdf.output('blob'), summaryPng, filename: report.filename };
}
