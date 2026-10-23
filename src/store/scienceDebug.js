import { createStore } from 'zustand/vanilla';
import { scienceActions } from './scienceStore';
import { emptyScienceState } from '../utils/scienceV3';
import { scienceProgramWeekRange } from '../utils/scienceCalendar';

function syntheticWeek(state, scenario) {
  if (!['empty', 'good', 'fatigue'].includes(scenario)) return {};
  const range = scienceProgramWeekRange(state.scienceState.program);
  const outsideWeek = state.history.filter(w => w.startTime < range.start || w.startTime >= range.end);
  if (scenario === 'empty') return { history: outsideWeek };
  const science = structuredClone(state.scienceState);
  const p = science.program;
  const workouts = [0, 1].map(index => {
    const id = `debug-${p.id}-${p.currentWeek}-${index}`;
    const time = new Date(range.start);
    time.setDate(time.getDate() + index * 3);
    time.setHours(12, 0, 0, 0);
    const exercises = Object.entries(p.targets).filter(([, target]) => target > 0).map(([muscle, target]) => {
      const exerciseId = `${id}-${muscle}`;
      const count = index === 0 ? Math.ceil(target / 2) : Math.floor(target / 2);
      const sets = Array.from({ length: count }, (_, i) => ({ id: `${exerciseId}-${i}`, done: true, kg: 20, reps: scenario === 'fatigue' ? Math.max(4, 10 - p.currentWeek) : 10 + p.currentWeek }));
      science.exerciseSnapshots[id] = { ...science.exerciseSnapshots[id], [exerciseId]: { name: `Test ${muscle}`, primary: muscle, indirect: [] } };
      science.annotations[id] = { ...science.annotations[id], [exerciseId]: Object.fromEntries(sets.map(s => [s.id, { rir: 0 }])) };
      return { id: exerciseId, name: `Test ${muscle}`, sets };
    });
    science.feedback[id] = { sleep: scenario === 'good' ? 'good' : 'poor', systemicFatigue: scenario === 'fatigue', muscles: Object.fromEntries(Object.keys(p.targets).map(m => [m, { recovery: scenario === 'good' ? 'good' : 'poor', quality: scenario === 'good' ? 'good' : 'poor', pain: false }])) };
    return { id, name: 'DEBUG · seduta simulata', startTime: time.getTime(), endTime: time.getTime() + 3600000, exercises };
  });
  return { scienceState: science, history: [...outsideWeek, ...workouts] };
}

// No persist middleware and no reference to live actions. Discarding this store
// discards the entire simulation, even after a reload or a closed tab.
export function createScienceSandbox(source, now = Date.now()) {
  const data = structuredClone(Object.fromEntries(['history', 'scienceState', 'scienceReport', 'customExercises', 'exerciseOverrides', 'weightLog', 'userXP', 'muscleXP', 'currentStreak', 'highestStreak', 'templates'].map(k => [k, source[k]])));
  const initial = { ...data, scienceState: data.scienceState || emptyScienceState(), scienceReport: null, showScience: true, scienceDebugNow: now };
  return createStore(set => ({ ...structuredClone(initial), ...scienceActions(set),
    advanceScienceDebugWeek: (scenario = 'empty') => set(state => {
      const p = state.scienceState?.program;
      if (!p || p.status !== 'active') return state;
      return { ...syntheticWeek(state, scenario), scienceDebugNow: Math.max(state.scienceDebugNow, scienceProgramWeekRange(p).end) };
    }),
    advanceScienceDebugDay: () => set(state => {
      if (state.scienceState?.program?.status !== 'active') return state;
      const next = new Date(state.scienceDebugNow);
      next.setDate(next.getDate() + 1);
      return { scienceDebugNow: next.getTime() };
    }),
    resetScienceDebug: () => set(structuredClone(initial)),
  }));
}
