import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { getAllExercises, EXERCISES_DB } from '../src/data/exercises';
import { useStore, getExercise1RMStats } from '../src/store/useStore';
import { cityFromGeocode, machineHistory, isMachineExercise, gymLabel, detectGymCity } from '../src/utils/gymLocation';
import { calculateSessionScore } from '../src/utils/gamification';

const cityA = { id: 'it:it-25:milano', name: 'Milano', country: 'IT', region: 'IT-25' };
const cityB = { id: 'it:it-25:monza', name: 'Monza', country: 'IT', region: 'IT-25' };
const start = new Date(2026, 9, 29, 10).getTime();
const workout = (id, city, kg = 60) => ({ id, startTime: start - (10 - id) * 86400000, endTime: start, gymLocation: city, exercises: ['Chest Press', 'Panca Piana Bilanciere', 'Spinte Manubri Panca Piana'].map((name, i) => ({ id: i, name, sets: [{ id: i, done: true, kg, reps: 10 }] })) });
const history = [workout(3, cityB, 120), workout(2, cityA, 60), workout(1, null, 200)];
const template = { id: 'tpl', name: 'Test', exercises: history[0].exercises.map(ex => ({ name: ex.name, setsCount: 1 })) };
const original = useStore.getInitialState();
beforeEach(() => useStore.setState({ ...original, history: structuredClone(history), activeWorkout: null, customExercises: [], exerciseOverrides: {}, gymLocationPreferences: { introVersion: 1, capture: true, adaptLoads: true }, gymLocationAliases: {} }, true));
afterEach(() => vi.unstubAllGlobals());

describe('machine-only location comparisons', () => {
  it('distinguishes catalog machines, cables and free/bodyweight exercises', () => {
    for (const name of ['Chest Press', 'Lat Machine Avanti', 'Pushdown Corda', 'Panca Inclinata MultiPower']) expect(isMachineExercise(name, EXERCISES_DB)).toBe(true);
    for (const name of ['Panca Piana Bilanciere', 'Spinte Manubri Panca Piana', 'Dip alla Panca', 'Trazioni alla Sbarra (Pull-up)']) expect(isMachineExercise(name, EXERCISES_DB)).toBe(false);
  });
  it('keeps old machine overrides compatible and allows explicitly changing equipment', () => {
    expect(isMachineExercise('Chest Press', getAllExercises([], { c4: { equipmentType: 'barbell' } }))).toBe(true);
    expect(isMachineExercise('Chest Press', getAllExercises([], { c4: { equipmentType: 'barbell', machineTypeVersion: 1 } }))).toBe(false);
    expect(isMachineExercise('Custom', getAllExercises([{ name: 'Custom', equipmentType: 'machine' }], {}))).toBe(true);
  });
  it('limits machine PRs to the local city, leaving weights and dumbbells global', () => {
    const current = { gymLocation: cityA, machineLocationScoped: true };
    expect(getExercise1RMStats(machineHistory(history, 'Chest Press', EXERCISES_DB, current), 'Chest Press').lastSession.set.kg).toBe(60);
    for (const name of ['Panca Piana Bilanciere', 'Spinte Manubri Panca Piana']) expect(machineHistory(history, name, EXERCISES_DB, current)).toBe(history);
    expect(machineHistory(history, 'Chest Press', EXERCISES_DB, { ...current, machineLocationScoped: false })).toBe(history);
  });
  it('has no machine baseline while location is missing or in a new city', () => {
    expect(machineHistory(history, 'Chest Press', EXERCISES_DB, { machineLocationScoped: true })).toEqual([]);
    expect(machineHistory(history, 'Chest Press', EXERCISES_DB, { machineLocationScoped: true, gymLocation: { id: 'new' } })).toEqual([]);
  });
  it('keeps scoring comparisons on the same machine location', () => {
    const current = { ...workout(9, cityB, 80), machineLocationScoped: true, exercises: [workout(9, cityB, 80).exercises[0]] };
    const score = calculateSessionScore(current, history, EXERCISES_DB);
    expect(score.exercisesAnalysis[0].overloaded).toBe(false);
    current.gymLocation = { id: 'new', name: 'Nuovo' };
    expect(calculateSessionScore(current, history, EXERCISES_DB).exercisesAnalysis[0].status).toBe('new');
  });
});

describe('location capture and prefill', () => {
  it('waits for the city before prefilling machines and then uses local weights', () => {
    useStore.getState().startWorkout(template);
    const session = useStore.getState().activeWorkout;
    expect(session.exercises[0].sets[0].kg).toBe('');
    expect(session.exercises[1].sets[0].kg).toBe(120);
    useStore.getState().attachWorkoutLocation(session.id, cityA);
    expect(useStore.getState().activeWorkout.exercises[0].sets[0].kg).toBe(60);
    expect(useStore.getState().activeWorkout.exercises[1].sets[0].kg).toBe(120);
  });
  it('does not overwrite typed sets or attach a late result to another session', () => {
    useStore.getState().startWorkout(template);
    const session = useStore.getState().activeWorkout;
    const ex = session.exercises[0];
    useStore.getState().updateActiveWorkoutSet(ex.id, ex.sets[0].id, 'kg', '45');
    useStore.getState().attachWorkoutLocation(session.id + 1, cityA);
    expect(useStore.getState().activeWorkout.gymLocation).toBeUndefined();
    useStore.getState().attachWorkoutLocation(session.id, cityA);
    expect(useStore.getState().activeWorkout.exercises[0].sets[0].kg).toBe('45');
  });
  it('clears global prefill when the user opts in on the first workout', () => {
    useStore.setState({ gymLocationPreferences: { introVersion: 0, capture: false, adaptLoads: false } });
    useStore.getState().startWorkout(template);
    expect(useStore.getState().activeWorkout.exercises[0].sets[0].kg).toBe(120);
    useStore.getState().setGymLocationPreferences({ introVersion: 1, capture: true, adaptLoads: true });
    const session = useStore.getState().activeWorkout;
    expect(session.exercises[0].sets[0].kg).toBe('');
    useStore.getState().attachWorkoutLocation(session.id, cityA);
    expect(useStore.getState().activeWorkout.exercises[0].sets[0].kg).toBe(60);
  });
  it('preserves existing active-session entries when opting in after an upgrade', () => {
    useStore.setState({ gymLocationPreferences: { introVersion: 0, capture: false, adaptLoads: false } });
    useStore.getState().startWorkout(template);
    const session = { ...useStore.getState().activeWorkout }; delete session.gymIntroFresh;
    useStore.setState({ activeWorkout: session });
    useStore.getState().setGymLocationPreferences({ introVersion: 1, capture: true, adaptLoads: true });
    expect(useStore.getState().activeWorkout.exercises[0].sets[0].kg).toBe(120);
  });
  it('does not persist coordinates even if the provider result contains extra fields', () => {
    useStore.getState().startWorkout(template);
    useStore.getState().attachWorkoutLocation(useStore.getState().activeWorkout.id, { ...cityA, latitude: 45, longitude: 9, address: 'private' });
    expect(useStore.getState().activeWorkout.gymLocation).toEqual(cityA);
  });
  it('tags sessions while keeping global defaults when adaptation is disabled', () => {
    useStore.setState({ gymLocationPreferences: { introVersion: 1, capture: true, adaptLoads: false } });
    useStore.getState().startWorkout(template);
    const session = useStore.getState().activeWorkout;
    useStore.getState().attachWorkoutLocation(session.id, cityA);
    expect(useStore.getState().activeWorkout.exercises[0].sets[0].kg).toBe(120);
    expect(useStore.getState().activeWorkout.gymLocation).toEqual(cityA);
  });
  it('keeps the stored location when saving, and aliases never change IDs or history', () => {
    useStore.getState().startWorkout(template);
    useStore.getState().attachWorkoutLocation(useStore.getState().activeWorkout.id, cityA);
    useStore.getState().finishWorkout();
    useStore.getState().renameGymLocation(cityA.id, '  Palestra Centrale  ');
    expect(useStore.getState().history[0].gymLocation).toEqual(cityA);
    expect(gymLabel(cityA, useStore.getState().gymLocationAliases)).toBe('Palestra Centrale');
    expect(gymLabel(null)).toBe('Località non disponibile');
  });
});

describe('GPS and geocoding privacy and failure handling', () => {
  it('creates stable city identifiers without storing coordinates', () => {
    const location = cityFromGeocode({ countryCode: 'IT', principalSubdivisionCode: 'IT-25', city: 'Milano', locality: 'Quartiere', latitude: 45, longitude: 9 });
    expect(location).toEqual(cityA);
    expect(() => cityFromGeocode({ countryCode: 'IT' })).toThrow();
  });
  it('uses live GPS once per request and returns only city data', async () => {
    const getCurrentPosition = vi.fn(resolve => resolve({ coords: { latitude: 45.46, longitude: 9.18 } }));
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ countryCode: 'IT', principalSubdivisionCode: 'IT-25', city: 'Milano' }) }));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } }); vi.stubGlobal('fetch', fetch);
    expect(await detectGymCity()).toEqual(cityA);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain('latitude=45.46000');
  });
  it('does not geocode or guess location from IP when permission is denied', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_, reject) => reject({ code: 1 }) } });
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(detectGymCity()).rejects.toThrow('negato');
    expect(fetch).not.toHaveBeenCalled();
  });
});
