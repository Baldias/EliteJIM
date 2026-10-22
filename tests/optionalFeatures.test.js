import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { existingFeaturePreferences } from '../src/utils/featurePreferences';
import { shiftWeightMonth, weightCalendarDays } from '../src/utils/weightCalendar';
import { normalizeBackupPayload } from '../src/utils/backup';

const original = useStore.getInitialState();
afterEach(() => useStore.setState(original, true));

describe('optional sections and historical weigh-ins', () => {
  it('starts fresh installs with both optional sections off', () => {
    expect(original.showScience).toBe(false);
    expect(original.showDiary).toBe(false);
    const merge = useStore.persist.getOptions().merge;
    expect(merge(undefined, original)).toMatchObject({ showScience: false, showDiary: false });
  });
  it('preserves existing choices and the Diary availability of earlier installs', () => {
    const merge = useStore.persist.getOptions().merge;
    expect(merge({ history: [{ id: 1 }], showScience: false }, original)).toMatchObject({ showScience: false, showDiary: true, history: [{ id: 1 }] });
    expect(existingFeaturePreferences({ showScience: true, showDiary: false })).toEqual({ showScience: true, showDiary: false });
    expect(normalizeBackupPayload({ history: [] }).state).toMatchObject({ showScience: true, showDiary: true });
    expect(normalizeBackupPayload({ state: { showScience: false, showDiary: false } }).state).toMatchObject({ showScience: false, showDiary: false });
  });
  it('switches sections independently without modifying logs, goals, science or XP', () => {
    useStore.setState(original, true);
    const data = () => JSON.stringify(Object.fromEntries(['history', 'scienceReport', 'scienceState', 'userXP', 'muscleXP', 'currentStreak', 'weightLog', 'foodDiary', 'nutritionGoals'].map(key => [key, useStore.getState()[key]])));
    const before = data();
    useStore.getState().toggleScience();
    expect(useStore.getState()).toMatchObject({ showScience: true, showDiary: false });
    useStore.getState().toggleDiary();
    expect(useStore.getState()).toMatchObject({ showScience: true, showDiary: true });
    useStore.getState().toggleScience();
    useStore.getState().toggleDiary();
    expect(data()).toBe(before);
  });
  it('saves and corrects an older weight by its chosen date, keeping latest bodyweight and XP intact', () => {
    useStore.setState({ ...original, weightLog: [], bodyweight: null, userXP: 4500, muscleXP: { Petto: 200 } }, true);
    useStore.getState().addWeightEntry('2026-10-22', 81);
    useStore.getState().addWeightEntry('2026-09-03', 76.5);
    useStore.getState().addWeightEntry('2026-09-03', 76.8);
    expect(useStore.getState().weightLog).toEqual([{ date: '2026-09-03', kg: 76.8 }, { date: '2026-10-22', kg: 81 }]);
    expect(useStore.getState()).toMatchObject({ bodyweight: 81, userXP: 4500, muscleXP: { Petto: 200 } });
  });
  it('uses local dates for calendar months, leap years and year boundaries', () => {
    expect(weightCalendarDays('2024-02').filter(Boolean)).toHaveLength(29);
    expect(weightCalendarDays('2026-09').slice(0, 3)).toEqual([null, '2026-09-01', '2026-09-02']);
    expect(weightCalendarDays('2026-03').filter(Boolean).at(-1)).toBe('2026-03-31');
    expect(shiftWeightMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftWeightMonth('2026-12', 1)).toBe('2027-01');
  });

});
