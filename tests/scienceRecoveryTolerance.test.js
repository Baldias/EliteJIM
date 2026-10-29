import { beforeEach, describe, expect, it } from 'vitest';
import { EXERCISES_DB } from '../src/data/exercises';
import { createScienceProgram, emptyScienceState, closeScienceWeek, scienceWeekRange } from '../src/utils/scienceV3';
import { useStore } from '../src/store/useStore';
import { normalizeBackupPayload } from '../src/utils/backup';

const start = new Date(2026, 9, 19).getTime();
const profile = { startDate: start, experience: 'advanced', goal: 'specialization', priorities: ['Petto'], daysPerWeek: 5, minutesPerSession: 90 };
const program = () => createScienceProgram(profile, [], EXERCISES_DB, emptyScienceState(), null, start);
const workout = (id, count = 10, name = 'Panca Piana Bilanciere', week = 1, kg = 60) => ({
  id, startTime: scienceWeekRange(start, week).start + id * 3600000,
  exercises: [{ id: `ex-${id}`, name, sets: Array.from({ length: count }, (_, i) => ({ id: `set-${i}`, done: true, kg, reps: 10 })) }],
});
function feedback(science, w, muscle = 'Petto', changes = {}, systemicFatigue = false) {
  science.feedback[w.id] = { sleep: 'good', systemicFatigue, muscles: { [muscle]: { recovery: 'good', quality: 'good', pain: false, ...changes } } };
}
const close = (science, history, week = 1) => closeScienceWeek(science, history, EXERCISES_DB, scienceWeekRange(start, week).end);

describe('target muscle accumulation tolerates mild fatigue', () => {
  it.each([
    { recovery: 'fair' }, { quality: 'fair' }, { pain: 'mild' },
    { recovery: 'fair', quality: 'fair', pain: 'mild' },
    { recovery: 'poor' }, { quality: 'poor' },
  ])('adds one set after an isolated non-blocking check: %j', check => {
    const science = program(), w = workout(1);
    feedback(science, w, 'Petto', check);
    const before = structuredClone(science);
    const next = close(science, [w]);
    expect(next.program.targets.Petto).toBe(science.program.targets.Petto + 1);
    expect(next.program.recommendations.filter(r => r.type === 'recovery')).toEqual([]);
    expect(next.program.landmarks.Petto.fatigueSignals).toEqual([]);
    expect(science).toEqual(before);
  });
  it('adds volume even after repeated mild fatigue, without RIR, and keeps other muscles at their base', () => {
    const science = program(), ws = [workout(1, 5), workout(2, 5), workout(3, 10, 'Rematore con Bilanciere')];
    ws.slice(0, 2).forEach(w => feedback(science, w, 'Petto', { recovery: 'fair', quality: 'fair', pain: 'mild' }, 'mild'));
    feedback(science, ws[2], 'Dorso');
    const next = close(science, ws);
    expect(next.program.targets.Petto).toBe(11);
    expect(next.program.targets.Dorso).toBe(10);
    expect(next.program.roles.Dorso).toBe('support');
    expect(next.program.recommendations).toEqual([]);
    expect(next.annotations).toEqual({});
  });
  it('does not require missing feedback or RIR to be invented for normal growth', () => {
    const science = program();
    const next = close(science, [workout(1)]);
    expect(next.program.targets.Petto).toBe(12);
    expect(next.feedback).toEqual({});
    expect(next.annotations).toEqual({});
  });
  it.each([
    { pain: true }, { recovery: 'poor', quality: 'poor' },
  ])('blocks the affected target for a marked problem: %j', check => {
    const science = program(), w = workout(1);
    feedback(science, w, 'Petto', check);
    const next = close(science, [w]);
    expect(next.program.targets.Petto).toBe(10);
    expect(next.program.recommendations.find(r => r.type === 'recovery').muscles).toEqual(['Petto']);
  });
  it('blocks repeated poor recovery and repeated marked systemic fatigue, while an isolated fatigue report allows +1', () => {
    const science = program(), ws = [workout(1, 5), workout(2, 5)];
    ws.forEach(w => feedback(science, w, 'Petto', { recovery: 'poor' }));
    expect(close(science, ws).program.targets.Petto).toBe(10);
    ws.forEach(w => feedback(science, w, 'Petto', {}, true));
    const next = close(science, ws);
    expect(next.program.targets.Petto).toBe(10);
    expect(next.program.recommendations.find(r => r.type === 'recovery').systemic).toBe(true);
    feedback(science, ws[1]);
    expect(close(science, ws).program.targets.Petto).toBe(11);
  });
  it('does not let a local recovery problem block another priority', () => {
    const science = createScienceProgram({ ...profile, priorities: ['Petto', 'Dorso'] }, [], EXERCISES_DB, emptyScienceState(), null, start);
    const ws = [workout(1), workout(2, 10, 'Rematore con Bilanciere')];
    feedback(science, ws[0], 'Petto', { pain: true });
    feedback(science, ws[1], 'Dorso', { recovery: 'fair' });
    const next = close(science, ws);
    expect(next.program.targets.Petto).toBe(10);
    expect(next.program.targets.Dorso).toBe(11);
  });
  it('grows priorities through W4 while preserving the other bases and the W5 recovery proposal', () => {
    let science = program();
    for (let week = 1; week <= 4; week++) {
      const w = workout(1, science.program.targets.Petto, undefined, week);
      feedback(science, w, 'Petto', { recovery: 'fair' });
      const previous = science.program.targets.Petto;
      science = close(science, [w], week);
      expect(science.program.targets.Petto).toBe(previous + (week < 4 ? 1 : 0));
      expect(science.program.targets.Dorso).toBe(10);
    }
    expect(science.program.currentWeek).toBe(5);
    expect(science.program.recommendations.at(-1)).toMatchObject({ type: 'deload', status: 'pending' });
  });
  it('still requires enough completed work and respects a manual ceiling', () => {
    const science = program();
    expect(close(science, [workout(1, 7)]).program.targets.Petto).toBe(10);
    expect(close(science, [workout(1, 8)]).program.targets.Petto).toBeGreaterThan(10);
    science.program.ceilings.Petto = 10;
    expect(close(science, [workout(1)]).program.targets.Petto).toBe(10);
  });
});

const original = useStore.getInitialState();
beforeEach(() => useStore.setState({ ...original, history: [workout(1)], scienceState: program() }, true));
describe('feedback severity persistence', () => {
  it('keeps mild distinct from marked fatigue and pain in the store and backup', () => {
    useStore.getState().saveScienceFeedback(1, { sleep: 'fair', systemicFatigue: 'mild', muscles: { Petto: { recovery: 'fair', quality: 'fair', pain: 'mild' } } });
    const science = useStore.getState().scienceState;
    expect(science.feedback[1]).toMatchObject({ systemicFatigue: 'mild', muscles: { Petto: { pain: 'mild' } } });
    expect(normalizeBackupPayload(JSON.parse(JSON.stringify({ scienceState: science }))).state.scienceState.feedback).toEqual(science.feedback);
    expect(close(science, [workout(1)]).program.targets.Petto).toBe(11);
    useStore.getState().saveScienceFeedback(1, { systemicFatigue: true, muscles: { Petto: { pain: true } } });
    expect(close(useStore.getState().scienceState, [workout(1)]).program.targets.Petto).toBe(10);
  });
});
