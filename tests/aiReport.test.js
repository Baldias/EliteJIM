import { describe, expect, it } from 'vitest';
import { aiReportRange, buildAiReport, formatSets } from '../src/utils/aiReport';
import { buildDemoState } from '../src/demo/demoData';

const DAY = 86400000;
const now = new Date(2026, 10, 10, 20, 0).getTime();
const workout = (daysAgo, sets, extra = {}) => ({
  id: `w${daysAgo}`, name: 'Push', startTime: now - daysAgo * DAY, endTime: now - daysAgo * DAY + 3600000,
  exercises: [{ id: 'e1', name: 'Panca Piana Bilanciere', sets }], ...extra,
});
const set = (kg, reps, more = {}) => ({ id: `${kg}-${reps}-${Math.random()}`, kg, reps, done: true, ...more });

describe('Report AI', () => {
  it('groups sets by load and marks RIR, drop sets and warmups', () => {
    const w = workout(1, [set(40, 10, { isWarmup: true }), set(80, 8, { rir: 1 }), set(80, 7, { rir: 0 }), set(75, 10), set(60, 8, { isDropset: true }), set(90, 1, { done: false })]);
    expect(formatSets(w, w.exercises[0], null)).toBe('80 kg × 8 R1, 7 R0 · 75 kg × 10 · D 60 kg × 8 (+1 risc.)');
  });

  it('reads the RIR saved by Scienza when the set has none', () => {
    const w = workout(1, [{ id: 's1', kg: 80, reps: 8, done: true }]);
    const science = { annotations: { w1: { e1: { s1: { rir: 0 } } } } };
    expect(formatSets(w, w.exercises[0], science)).toBe('80 kg × 8 R0');
  });

  it('keeps only the workouts of the chosen period', () => {
    const state = { history: [workout(2, [set(80, 8)]), workout(20, [set(75, 8)]), workout(100, [set(70, 8)])] };
    expect(buildAiReport(state, { periodId: '7d' }, now).workouts).toBe(1);
    expect(buildAiReport(state, { periodId: '30d' }, now).workouts).toBe(2);
    expect(buildAiReport(state, { periodId: 'all' }, now).workouts).toBe(3);
    const custom = buildAiReport(state, { periodId: 'custom', custom: { from: '2026-10-15', to: '2026-10-25' } }, now);
    expect(custom.workouts).toBe(1);
  });

  it('starts "all" from the first workout and swaps reversed custom dates', () => {
    const range = aiReportRange('all', [workout(50, [])], now);
    expect(new Date(range.from).getDate()).toBe(new Date(now - 50 * DAY).getDate());
    const custom = aiReportRange('custom', [], now, { from: '2026-11-05', to: '2026-11-01' });
    expect(new Date(custom.from).getDate()).toBe(1);
    expect(new Date(custom.to).getDate()).toBe(5);
  });

  it('writes progress, weekly sets per muscle, notes and the prompt', () => {
    const state = { history: [workout(1, [set(85, 8)], { sessionNote: 'spalla  tirava' }), workout(5, [set(80, 8)])] };
    const { text } = buildAiReport(state, { periodId: '30d', question: 'perché?' }, now);
    expect(text).toContain('Domanda specifica: perché?');
    expect(text).toContain('Panca Piana Bilanciere: 2 sedute, 2 serie · 80×8 → 85×8');
    expect(text).toMatch(/Serie a settimana per muscolo \(media\): Petto/);
    expect(text).toContain('Nota: spalla tirava');
    expect(buildAiReport(state, { periodId: '30d', prompt: false }, now).text.startsWith('# Dati EliteJIM')).toBe(true);
    expect(buildAiReport(state, { periodId: '30d', include: { notes: false } }, now).text).not.toContain('spalla');
  });

  it('summarises long periods and details only the last weeks', () => {
    const history = Array.from({ length: 40 }, (_, i) => workout(i * 7 + 1, [set(80, 8)]));
    const report = buildAiReport({ history }, { periodId: '365d' }, now);
    expect(report.detail).toBe('summary');
    expect(report.text).toContain('## Andamento per settimana');
    expect((report.text.match(/^### /gm) || []).length).toBe(4);
  });

  it('adds weight trend and nutrition averages in the period', () => {
    const state = {
      weightLog: [{ date: '2026-10-01', kg: 80 }, { date: '2026-11-01', kg: 79 }, { date: '2026-11-09', kg: 78.5 }],
      foodDiary: { '2026-11-09': { lunch: [{ grams: 100, food: { per100: { kcal: 2000, protein: 150, carbs: 200, fat: 60 } } }] } },
    };
    const { text } = buildAiReport(state, { periodId: '30d' }, now);
    expect(text).toMatch(/2 pesate · tendenza/);
    expect(text).toContain('1 giorni registrati · media al giorno: 2000 kcal, proteine 150 g');
  });

  it('works on the demo data', () => {
    const report = buildAiReport(buildDemoState(), { periodId: 'all' });
    expect(report.workouts).toBeGreaterThan(0);
    expect(report.text).toContain('## Esercizi');
  });
});
