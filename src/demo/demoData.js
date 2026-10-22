import { getAllExercises } from '../data/exercises';
import { recalculateTotalXpFromHistory } from '../utils/gamification';

const DAY = 24 * 60 * 60 * 1000;
const WEEKS = 8;
const BODYWEIGHT = 78;

// Deterministic pseudo-random numbers: every visitor sees the same history.
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const roundTo = (value, step) => Math.round(value / step) * step;

// Same programs as the default templates, with a starting load and weekly increase.
const PROGRAM = [
  {
    templateId: 'tpl-1',
    name: 'Spinta (Petto/Spalle/Tricipiti)',
    exercises: [
      { name: 'Panca Piana Bilanciere', sets: 3, reps: [8, 10], kg: 70, inc: 1.25, step: 2.5, rest: 90 },
      { name: 'Military Press', sets: 3, reps: [8, 10], kg: 40, inc: 0.75, step: 2.5, rest: 90 },
      { name: 'Alzate Laterali Manubri', sets: 3, reps: [12, 15], kg: 8, inc: 0.25, step: 1, rest: 60 },
      { name: 'Pushdown Tricipiti ai Cavi', sets: 3, reps: [12, 15], kg: 25, inc: 0.6, step: 2.5, rest: 60 }
    ]
  },
  {
    templateId: 'tpl-2',
    name: 'Trazione (Dorso/Bicipiti)',
    exercises: [
      { name: 'Trazioni alla Sbarra (Pull-up)', sets: 3, reps: [6, 8], kg: 0, inc: 1, step: 2.5, rest: 120 },
      { name: 'Rematore con Bilanciere', sets: 3, reps: [8, 10], kg: 60, inc: 1.25, step: 2.5, rest: 90 },
      { name: 'Pulley Basso', sets: 3, reps: [10, 12], kg: 50, inc: 1, step: 2.5, rest: 90 },
      { name: 'Curl Bilanciere', sets: 3, reps: [10, 12], kg: 25, inc: 0.5, step: 2.5, rest: 60 }
    ]
  },
  {
    templateId: 'tpl-3',
    name: 'Leg Day (Quadricipiti & Femorali)',
    exercises: [
      { name: 'Squat con Bilanciere', sets: 3, reps: [6, 8], kg: 90, inc: 2, step: 2.5, rest: 120 },
      { name: 'Leg Extension', sets: 3, reps: [12, 15], kg: 45, inc: 1, step: 2.5, rest: 60 },
      { name: 'Leg Curl', sets: 3, reps: [12, 15], kg: 35, inc: 0.8, step: 2.5, rest: 60 },
      { name: 'Calf Raise Seduto', sets: 3, reps: [15, 20], kg: 40, inc: 1, step: 2.5, rest: 60 }
    ]
  }
];

const buildHistory = (now) => {
  const rand = mulberry32(42);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // Monday of the current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const sessions = [];
  let id = 1;
  for (let week = WEEKS - 1; week >= 0; week--) {
    // Push on Monday, Pull on Wednesday, Legs on Friday
    [0, 2, 4].forEach((dayOffset, idx) => {
      const day = new Date(monday.getTime() - week * 7 * DAY + dayOffset * DAY);
      day.setHours(18, Math.floor(rand() * 40), 0, 0);
      const startTime = day.getTime();
      if (startTime > now - 2 * 60 * 60 * 1000) return; // only sessions already done

      const program = PROGRAM[idx];
      const weekIndex = WEEKS - 1 - week;
      const exercises = program.exercises.map((ex, exIdx) => {
        const kg = Math.max(0, roundTo(ex.kg + ex.inc * weekIndex, ex.step));
        const [minReps, maxReps] = ex.reps;
        const sets = Array.from({ length: ex.sets }, (_, s) => {
          // First set at the top of the range, later sets drop a rep or two
          const reps = Math.max(minReps, maxReps - s - Math.floor(rand() * 2));
          return {
            id: startTime + exIdx * 100 + s,
            kg: kg > 0 ? String(kg) : '',
            reps: String(reps),
            targetReps: `${minReps}-${maxReps}`,
            done: true
          };
        });
        return {
          id: startTime + exIdx * 100,
          name: ex.name,
          notes: '',
          restTime: ex.rest,
          isAdded: false,
          sets
        };
      });

      sessions.push({
        id: id++,
        templateId: program.templateId,
        name: program.name,
        startTime,
        endTime: startTime + (55 + Math.floor(rand() * 25)) * 60 * 1000,
        exercises
      });
    });
  }
  // History is newest first
  return sessions.sort((a, b) => b.startTime - a.startTime);
};

export const buildDemoState = () => {
  const now = Date.now();
  const history = buildHistory(now);
  const { userXP, muscleXP, currentStreak, highestStreak } =
    recalculateTotalXpFromHistory(history, getAllExercises([], {}), BODYWEIGHT);

  return {
    history,
    bodyweight: BODYWEIGHT,
    userXP,
    muscleXP,
    currentStreak,
    highestStreak,
    lastWorkoutDate: history[0] ? history[0].endTime : null,
    // No backup reminders: demo data lives only in this tab
    autoBackupEnabled: false,
    lastBackupDate: now
  };
};
