import { SCIENCE_LANDMARK_COLORS } from './sciencePlanning';

const WIDTH = 1080, HEIGHT = 1440, PAD = 64;
const C = { bg: '#07090C', panel: '#11151B', border: '#252C36', text: '#F5F7FA', muted: '#8A94A3', cyan: '#00B4E6', green: '#30D158', yellow: '#FFD60A', purple: '#BF5AF2', red: '#FF453A' };
const fmt = (value, digits = 0) => Number(value).toLocaleString('it-IT', { maximumFractionDigits: digits });
const date = time => new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' });
const chunks = (items, count) => Array.from({ length: Math.ceil(items.length / count) }, (_, i) => items.slice(i * count, (i + 1) * count));

export function progressReportPages(report) {
  const pages = [{ type: 'summary', title: 'Il mio percorso' }];
  const groups = new Map();
  report.exercises.forEach(ex => {
    const name = ex.group || 'Altri esercizi';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(ex);
  });
  for (const [group, exercises] of groups) {
    chunks(exercises, 2).forEach(items => pages.push({ type: 'exercises', title: `${group} · esercizi`, items }));
  }
  if (report.weight?.length) pages.push({ type: 'weight', title: 'Andamento del peso' });
  if (report.science) chunks(report.science.rows, 12).forEach(items => pages.push({ type: 'science', title: `Scienza · settimana ${report.science.week}`, items }));
  return pages;
}

function text(ctx, value, x, y, size = 20, color = C.text, weight = 500, align = 'left') {
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(String(value), x, y); ctx.textAlign = 'left';
}
function card(ctx, x, y, width, height, color = C.panel) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, 24); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
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
  text(ctx, 'ELITEJIM', PAD, 78, 26, C.cyan, 900);
  text(ctx, report.demo ? 'DATI DI ESEMPIO · DEMO' : 'IL MIO PERCORSO', WIDTH - PAD, 78, 15, C.muted, 750, 'right');
  wrapped(ctx, page.title, PAD, 154, WIDTH - PAD * 2, 43, C.text, 51, 900);
  text(ctx, report.period, PAD, 204, 17, C.muted);
  ctx.strokeStyle = C.border; ctx.beginPath(); ctx.moveTo(PAD, HEIGHT - 80); ctx.lineTo(WIDTH - PAD, HEIGHT - 80); ctx.stroke();
  text(ctx, `Report del ${date(report.generatedAt)} · tutti i dati registrati`, PAD, HEIGHT - 42, 15, C.muted);
  text(ctx, `${index + 1} / ${total}`, WIDTH - PAD, HEIGHT - 42, 16, C.muted, 600, 'right');
}
function summary(ctx, report) {
  const t = report.totals;
  text(ctx, report.rank.title, PAD, 256, 24, report.rank.color, 800);
  text(ctx, `${fmt(t.xp)} XP`, WIDTH - PAD, 256, 21, C.muted, 650, 'right');
  bar(ctx, PAD, 278, WIDTH - PAD * 2, report.rank.progress, 100, report.rank.color, 8);
  const metrics = [[t.workouts, 'ALLENAMENTI'], [t.completedSets, 'SERIE REGISTRATE'], [t.prCount, 'RECORD BATTUTI'], [t.overloadRate == null ? '—' : `${t.overloadRate}%`, 'SEDUTE IN OVERLOAD'], [`${t.currentStreak} sett.`, 'STREAK ATTUALE'], [`${t.highestStreak} sett.`, 'STREAK MIGLIORE']];
  metrics.forEach(([value, label], i) => {
    const x = PAD + i % 3 * 324, y = 322 + Math.floor(i / 3) * 156;
    card(ctx, x, y, 304, 136); text(ctx, typeof value === 'number' ? fmt(value) : value, x + 22, y + 64, 36, C.text, 850); text(ctx, label, x + 22, y + 105, 14, C.muted, 700);
  });
  text(ctx, 'La continuità, nel tempo', PAD, 716, 28, C.text, 800);
  text(ctx, `Serie registrate per ${report.activity.granularity} · intero storico`, PAD, 752, 18, C.muted);
  chart(ctx, report.activity.points, PAD, 782, WIDTH - PAD * 2, 290, { bars: true, valueKey: 'sets' });
  text(ctx, `${fmt(t.repetitions)} ripetizioni`, PAD, 1136, 24, C.cyan, 750);
  text(ctx, `${fmt(t.minutes / 60, 1)} ore registrate`, WIDTH - PAD, 1136, 24, C.cyan, 750, 'right');
  text(ctx, `${fmt(t.externalKg / 1000, 1)} t di carico esterno registrato`, PAD, 1180, 19, C.muted);
  wrapped(ctx, `${report.exercises.length} esercizi nel dettaglio nelle pagine successive. Totali e record seguono le formule dell’app; le serie registrate includono le tecniche di intensità.`, PAD, 1240, WIDTH - PAD * 2, 17, C.muted, 26);
}
function science(ctx, report, page) {
  text(ctx, `${report.science.phase} · ${report.science.accounting === 'legacy' ? 'conteggi originali' : 'serie dirette a 0–1 RIR'}`, PAD, 250, 18, C.muted);
  page.items.forEach((m, i) => {
    const y = 308 + i * 76;
    const color = SCIENCE_LANDMARK_COLORS[m.band] || C.cyan;
    text(ctx, m.name, PAD, y, 23, C.text, 700);
    if (m.focus) text(ctx, 'FOCUS', PAD + 240, y, 13, color, 850);
    text(ctx, `${m.done} / ${m.target} serie`, WIDTH - PAD, y, 20, color, 750, 'right');
    bar(ctx, PAD, y + 20, WIDTH - PAD * 2, m.done, Math.max(1, m.target), color, 8);
    if (m.unknown) text(ctx, `${m.unknown} senza RIR`, PAD, y + 48, 13, C.yellow);
  });
  text(ctx, report.science.accounting === 'legacy' ? 'Protocollo precedente conservato secondo le sue regole originali.' : 'Serie senza RIR, riscaldamento e tecniche escluse dai target scientifici.', PAD, 1285, 16, C.muted);
}
function exercise(ctx, ex, y) {
  card(ctx, PAD, y, WIDTH - PAD * 2, 500);
  const x = PAD + 28, width = WIDTH - PAD * 2 - 56;
  wrapped(ctx, ex.name, x, y + 47, width - 170, 25, C.text, 31, 800);
  if (!ex.points.length) { wrapped(ctx, `${ex.registeredSets} serie registrate. Non ci sono ancora serie ordinarie confrontabili per tracciare la progressione di questo esercizio. Le tecniche di intensità e il riscaldamento restano nei totali dello storico.`, x, y + 150, width, 21, C.muted, 35); return; }
  const label = ex.metric === 'estimated' ? '1RM stimato · carico esterno' : 'Ripetizioni sulla serie migliore';
  text(ctx, label, x, y + 110, 16, C.muted);
  const delta = ex.deltaPercent == null ? `${ex.points.length} osservazion${ex.points.length === 1 ? 'e' : 'i'}` : `${ex.deltaPercent > 0 ? '+' : ''}${fmt(ex.deltaPercent, 1)}%`;
  text(ctx, delta, WIDTH - PAD - 28, y + 48, 22, ex.deltaPercent < 0 ? C.red : C.green, 800, 'right');
  text(ctx, `${fmt(ex.first.value, 1)} → ${fmt(ex.latest.value, 1)} ${ex.unit}`, x, y + 158, 29, C.text, 800);
  text(ctx, 'Prima → ultima osservazione', x, y + 188, 15, C.muted);
  chart(ctx, ex.points, x, y + 213, width, 215, { unit: ex.unit });
  const top = ex.best.kg > 0 ? `${fmt(ex.best.kg, 1)} kg × ${fmt(ex.best.reps)} rep` : `${fmt(ex.best.reps)} rep a corpo libero / carico nullo`;
  text(ctx, `Serie di riferimento: ${top}`, x, y + 462, 16, C.muted);
}
function weight(ctx, report) {
  const values = report.weight, first = values[0], last = values.at(-1);
  text(ctx, 'Pesate del Diario · incluse su tua scelta', PAD, 260, 20, C.muted);
  const metrics = [[first.value, 'PRIMA PESATA'], [last.value, 'ULTIMA PESATA'], [last.value - first.value, 'VARIAZIONE KG']];
  metrics.forEach(([v, label], i) => { const x = PAD + i * 324; card(ctx, x, 308, 304, 138); text(ctx, `${fmt(v, 1)}${i < 2 ? ' kg' : ''}`, x + 22, 374, 34, C.text, 850); text(ctx, label, x + 22, 414, 15, C.muted); });
  chart(ctx, values, PAD, 516, WIDTH - PAD * 2, 480, { unit: 'kg', baseline: Math.max(0, Math.floor(Math.min(...values.map(p => p.value)) - 1)) });
  wrapped(ctx, 'La variazione del peso non misura da sola la crescita muscolare. Il grafico mostra tutte le pesate registrate e non interpreta una fase di massa o definizione.', PAD, 1090, WIDTH - PAD * 2, 20, C.muted, 34);
}

export async function renderProgressReport(report, { signal } = {}) {
  const { jsPDF } = await import('jspdf');
  await document.fonts?.ready;
  const pages = progressReportPages(report), images = [];
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossibile creare il report su questo browser.');
  const pdf = new jsPDF({ unit: 'px', format: [WIDTH, HEIGHT], orientation: 'portrait', compress: true, hotfixes: ['px_scaling'] });
  pdf.setProperties({ title: 'EliteJIM - Progressi completi', creator: 'EliteJIM', subject: 'Riepilogo e progressione di tutti gli esercizi registrati' });
  let summaryPng = null;
  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) throw new DOMException('Report annullato', 'AbortError');
    const page = pages[i]; header(ctx, report, page, i, pages.length);
    if (page.type === 'summary') summary(ctx, report);
    else if (page.type === 'science') science(ctx, report, page);
    else if (page.type === 'weight') weight(ctx, report);
    else { page.items.forEach((ex, j) => exercise(ctx, ex, 244 + j * 526)); text(ctx, 'Stime, non massimali testati. Serie ordinarie; a corpo libero, carico esterno aggiunto.', PAD, 1295, 15, C.muted); }
    if (i === 0) summaryPng = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const image = canvas.toDataURL('image/jpeg', 0.9); images.push(image);
    if (i > 0) pdf.addPage([WIDTH, HEIGHT], 'portrait');
    pdf.addImage(image, 'JPEG', 0, 0, WIDTH, HEIGHT, undefined, 'FAST');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { images, pages, pdfBlob: pdf.output('blob'), summaryPng, filename: report.filename };
}
