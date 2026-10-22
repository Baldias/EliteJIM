import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../src/store/useStore';
import { calculateSessionScore } from '../src/utils/gamification';
import { EXERCISES_DB } from '../src/data/exercises';
import { emptyScienceState, scienceWeekRange } from '../src/utils/scienceV3';
import { exportDataBackup, importDataBackup, normalizeBackupPayload } from '../src/utils/backup';

const start = new Date(2026, 8, 7).getTime();
const workout = { id: 42, name: 'Allenamento', startTime: start + 1000, endTime: start + 3600000, exercises: [{ id: 43, name: 'Panca Piana Bilanciere', sets: [{ id: 44, kg: 60, reps: 10, done: true }] }] };
const profile = { experience: 'advanced', goal: 'specialization', priorities: ['Petto'], daysPerWeek: 5, minutesPerSession: 90, startDate: start };
const protectedData = s => structuredClone(Object.fromEntries(['history', 'userXP', 'muscleXP', 'currentStreak', 'highestStreak', 'templates', 'bodyweight', 'scienceReport'].map(k => [k, s[k]])));
const original = useStore.getInitialState();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useStore.setState({ ...original, history: [structuredClone(workout)], userXP: 1750, muscleXP: { Petto: 480, Spalle: 360 }, currentStreak: 4, highestStreak: 12, scienceState: emptyScienceState() }, true);
});

describe('science isolation and backward compatibility', () => {
  it('preserves all historical/gamification fields across start, RIR, feedback and classification', () => {
    const before = protectedData(useStore.getState());
    useStore.getState().startScienceV3(profile, start);
    useStore.getState().annotateScienceSet(42, 43, 44, { rir: 0 });
    useStore.getState().saveScienceFeedback(42, { sleep: 'good', muscles: { Petto: { recovery: 'good' } } });
    useStore.getState().classifyScienceExercise(42, 43, 'Spalle');
    useStore.getState().setScienceTarget('Petto', 20, 24);
    useStore.getState().reestimateScienceStart();
    expect(protectedData(useStore.getState())).toEqual(before);
    expect(useStore.getState().scienceState.annotations[42][43][44].rir).toBe(0);
  });
  it('does not permit annotating missing sets or writing invalid RIR values', () => {
    useStore.getState().annotateScienceSet(42, 43, 999, { rir: 0 });
    expect(useStore.getState().scienceState.annotations).toEqual({});
    useStore.getState().annotateScienceSet(42, 43, 44, { rir: 3 });
    expect(useStore.getState().scienceState.annotations[42][43][44].rir).toBeNull();
  });
  it.each(['active', 'pending'])('keeps a %s legacy cycle intact and prevents premature V3', status => {
    const legacy = { status, currentWeek: 3, baseLandmarks: { Petto: { mev: 10, mav: 12, mrv: 20 } } };
    useStore.setState({ scienceReport: legacy });
    useStore.getState().startScienceV3(profile, start);
    expect(useStore.getState().scienceState.program).toBeNull();
    expect(useStore.getState().scienceReport).toEqual(legacy);
  });
  it('starts V3 after a completed legacy cycle without overwriting it', () => {
    const legacy = { status: 'completed', currentWeek: 12, weekHistory: { 1: { startDate: 1, completedDate: 2 } } };
    useStore.setState({ scienceReport: legacy });
    useStore.getState().startScienceV3(profile, start);
    expect(useStore.getState().scienceState.program.modelVersion).toBe(3);
    expect(useStore.getState().scienceReport).toEqual(legacy);
  });
  it('keeps all XP unchanged after an accepted or rejected recovery recommendation', () => {
    useStore.getState().startScienceV3(profile, start);
    const science = structuredClone(useStore.getState().scienceState);
    science.program.recommendations = [{ id: 'r', type: 'recovery', status: 'pending', muscles: ['Petto'] }];
    useStore.setState({ scienceState: science });
    const before = protectedData(useStore.getState());
    useStore.getState().respondScienceRecovery('r', 'reduce');
    expect(protectedData(useStore.getState())).toEqual(before);
    useStore.getState().respondScienceRecovery('r', 'reject');
    expect(protectedData(useStore.getState())).toEqual(before);
  });
  it('archives completed V3 programs and prevents duplicate active programs', () => {
    useStore.getState().startScienceV3(profile, start);
    const science = structuredClone(useStore.getState().scienceState);
    science.program.status = 'completed';
    useStore.setState({ scienceState: science });
    useStore.getState().startScienceV3(profile, start + 1000);
    useStore.getState().startScienceV3(profile, start + 2000);
    expect(useStore.getState().scienceState.archives).toHaveLength(1);
    expect(useStore.getState().scienceState.archives[0].id).toBe(science.program.id);
  });
  it('closes scientific weeks without changing logs and XP', () => {
    useStore.getState().startScienceV3(profile, start);
    const before = protectedData(useStore.getState());
    useStore.getState().closeScienceV3Week(scienceWeekRange(start, 1).end);
    expect(protectedData(useStore.getState())).toEqual(before);
    expect(useStore.getState().scienceState.program.weeks).toHaveLength(1);
  });
  it('repeats the quiz only on confirmation and archives the active program without touching logs or XP', () => {
    useStore.getState().startScienceV3(profile, start);
    useStore.getState().annotateScienceSet(42, 43, 44, { rir: 0 });
    const before = protectedData(useStore.getState());
    const previous = structuredClone(useStore.getState().scienceState.program);
    useStore.getState().restartScienceV3({ ...profile, priorities: ['Spalle'], startDate: start + 7 * 86400000 }, start + 1000);
    const science = useStore.getState().scienceState;
    expect(science.archives).toHaveLength(1);
    expect(science.archives[0]).toEqual({ ...previous, status: 'replaced', endedAt: start + 1000 });
    expect(science.program.currentWeek).toBe(1);
    expect(science.profile.priorities).toEqual(['Spalle']);
    expect(science.annotations[42][43][44].rir).toBe(0);
    expect(protectedData(useStore.getState())).toEqual(before);
  });
  it('preserves historical and gamification fields when adopting the new volume policy and changing weekly availability', () => {
    useStore.getState().startScienceV3(profile, start);
    const old = structuredClone(useStore.getState().scienceState);
    delete old.program.allocationVersion;
    for (const m of Object.keys(old.program.targets)) {
      if (m === 'Petto') continue;
      old.program.targets[m] = Math.ceil(old.program.targets[m] / 2);
      old.program.roles[m] = 'maintenance';
      old.program.landmarks[m].mevEstimate = null;
    }
    useStore.setState({ scienceState: old });
    const before = protectedData(useStore.getState());
    useStore.getState().adoptScienceAllocation(start);
    const updated = useStore.getState().scienceState;
    expect(updated.program.targets.Dorso).toBe(12);
    expect(updated.program.roles.Dorso).toBe('support');
    expect(updated.program.id).toBe(old.program.id);
    expect(updated.program.startDate).toBe(old.program.startDate);
    const targets = structuredClone(updated.program.targets);
    useStore.getState().setScienceWeekSessions(3);
    useStore.getState().deferScienceWeek(scienceWeekRange(start, 1).end);
    useStore.getState().deferScienceWeek(scienceWeekRange(start, 1).end);
    expect(useStore.getState().scienceState.program.sessionPlans[1].plannedSessions).toBe(3);
    expect(useStore.getState().scienceState.program.weekDeferrals).toHaveLength(1);
    expect(useStore.getState().scienceState.program.targets).toEqual(targets);
    expect(protectedData(useStore.getState())).toEqual(before);
    useStore.getState().adoptScienceAllocation(start);
    expect(useStore.getState().scienceState.program.targets).toEqual(targets);
  });
  it('does not close an open scientific week while a workout is in progress', () => {
    useStore.getState().startScienceV3(profile, start);
    useStore.setState({ activeWorkout: structuredClone(workout) });
    useStore.getState().closeScienceV3Week(scienceWeekRange(start, 1).end);
    expect(useStore.getState().scienceState.program.currentWeek).toBe(1);
    expect(useStore.getState().scienceState.program.weeks).toHaveLength(0);
  });
  it('gives the same session XP with or without science annotations', () => {
    const a = calculateSessionScore(workout, [], EXERCISES_DB, null, 80);
    useStore.getState().startScienceV3(profile, start);
    useStore.getState().annotateScienceSet(42, 43, 44, { rir: 0, excluded: true });
    expect(calculateSessionScore(useStore.getState().history[0], [], EXERCISES_DB, null, 80)).toEqual(a);
  });
  it('finishes a new workout with unchanged XP and freezes its scientific mapping', () => {
    useStore.getState().startScienceV3(profile, start);
    const active = { ...structuredClone(workout), id: 100, endTime: undefined };
    useStore.setState({ activeWorkout: active });
    const before = useStore.getState();
    const expected = calculateSessionScore({ ...active, endTime: Date.now() }, before.history, EXERCISES_DB, null, 75);
    useStore.getState().finishWorkout();
    const after = useStore.getState();
    expect(after.userXP).toBe(before.userXP + expected.xp);
    expect(after.scienceState.exerciseSnapshots[100][43].primary).toBe('Petto');
    expect(after.history[1]).toEqual(workout);
  });
  it('rehydrates an old backup with default science state and identical historical fields', async () => {
    const before = protectedData(useStore.getState());
    localStorage.setItem('elitejim-storage', JSON.stringify({ state: before, version: 0 }));
    useStore.setState({ scienceState: emptyScienceState() });
    // setState persists; restore the legacy payload before exercising rehydrate.
    localStorage.setItem('elitejim-storage', JSON.stringify({ state: before, version: 0 }));
    await useStore.persist.rehydrate();
    expect(protectedData(useStore.getState())).toEqual(before);
    expect(useStore.getState().scienceState.schemaVersion).toBe(1);
  });
});

describe('backup export and import', () => {
  it('keeps scientific demo data in sessionStorage without touching real localStorage', async () => {
    const real = localStorage.getItem('elitejim-storage');
    window.location.search = '?demo';
    vi.resetModules();
    const demo = await import('../src/demo/demoMode');
    const { useStore: demoStore } = await import('../src/store/useStore');
    expect(demo.IS_DEMO).toBe(true);
    expect(demo.getAppStorage()).toBe(sessionStorage);
    demoStore.getState().startScienceV3(profile, start);
    expect(JSON.parse(sessionStorage.getItem(demo.STORAGE_KEY)).state.scienceState.program.modelVersion).toBe(3);
    expect(localStorage.getItem('elitejim-storage')).toBe(real);
    window.location.search = '';
    sessionStorage.clear();
  });
  it('normalizes raw and wrapped old backups without carrying over another science program', () => {
    const legacy = { history: [workout], userXP: 123, muscleXP: { Petto: 456 } };
    for (const payload of [legacy, { state: legacy, version: 0 }]) {
      const normalized = normalizeBackupPayload(payload);
      expect(normalized.state.history).toEqual(legacy.history);
      expect(normalized.state.userXP).toBe(123);
      expect(normalized.state.scienceState).toEqual(emptyScienceState());
    }
  });
  it('includes all science data in emergency export and restores it losslessly', async () => {
    useStore.getState().startScienceV3(profile, start);
    useStore.getState().annotateScienceSet(42, 43, 44, { rir: 1 });
    const before = structuredClone(useStore.getState().scienceState);
    localStorage.clear();
    let blob;
    vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }), body: { appendChild: vi.fn(), removeChild: vi.fn() } });
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value; return 'blob:test'; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    expect(exportDataBackup()).toBe(true);
    const parsed = JSON.parse(await blob.text());
    expect(parsed.state.scienceState).toEqual(before);
    vi.stubGlobal('FileReader', class { readAsText(file) { this.onload({ target: { result: file.content } }); } });
    const done = vi.fn();
    importDataBackup({ content: JSON.stringify(parsed) }, done);
    expect(done).toHaveBeenCalledWith(true);
    expect(JSON.parse(localStorage.getItem('elitejim-storage')).state.scienceState).toEqual(before);
    create.mockRestore(); revoke.mockRestore();
  });
});
