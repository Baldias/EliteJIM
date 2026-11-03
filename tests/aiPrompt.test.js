import { describe, it, expect } from 'vitest';
import { buildAiWorkoutPrompt, exerciseStreaksForPrompt, scienceWeekForPrompt } from '../src/utils/aiRoutineHelper';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 28, 12).getTime();
const workout = (daysAgo, ...names) => ({
  startTime: NOW - daysAgo * DAY,
  exercises: names.map(name => ({ name, sets: [{ done: true }] })),
});
const db = [
  { name: 'Panca Piana Bilanciere', category: 'Petto', secondaryCategories: ['Tricipiti'] },
  { name: 'Squat', category: 'Quadricipiti' },
];
const science = {
  showScience: true,
  scienceReport: null,
  scienceState: {
    profile: { daysPerWeek: 4, priorities: ['Spalle'] },
    program: { status: 'active', currentWeek: 3, targets: { Petto: 12, Spalle: 10, Collo: 0 }, sessionPlans: { 3: { plannedSessions: 5 } } },
  },
};

describe('AI master prompt', () => {
  it('lists only streaks of two weeks or more, with the database spelling, longest first', () => {
    const history = [
      workout(1, 'panca piana bilanciere', 'Squat', 'Curl'),
      workout(8, 'Panca Piana Bilanciere', 'Squat'),
      workout(15, 'Panca Piana Bilanciere'),
    ];
    expect(exerciseStreaksForPrompt(history, db, NOW)).toEqual([
      { name: 'Panca Piana Bilanciere', weeks: 3 },
      { name: 'Squat', weeks: 2 },
    ]);
  });

  it('reads the current Scienza week, priorities first and without zero targets', () => {
    expect(scienceWeekForPrompt(science)).toEqual({
      week: 3, sessions: 5,
      targets: [{ muscle: 'Spalle', sets: 10, priority: true }, { muscle: 'Petto', sets: 12, priority: false }],
    });
    expect(scienceWeekForPrompt({ ...science, showScience: false })).toBeNull();
    expect(scienceWeekForPrompt({ ...science, scienceState: { ...science.scienceState, program: { ...science.scienceState.program, status: 'completed' } } })).toBeNull();
  });

  it('always states effort and volume rules, even with user notes', () => {
    const prompt = buildAiWorkoutPrompt({ allExercises: db, userNotes: 'No stacco', language: 'it' });
    expect(prompt).toContain('0-1 reps in reserve');
    expect(prompt).toContain('10-18 working sets');
    expect(prompt).toContain('No stacco');
    expect(prompt).not.toContain('ACTIVE STREAK');
    expect(prompt).not.toContain('USE ONLY THESE EXACT NAMES');
    expect(prompt).not.toContain('SCIENZA WEEKLY SETS');
  });

  it('asks for the exact Scienza sets and the planned days when the option is on', () => {
    const scienceWeek = scienceWeekForPrompt(science);
    const prompt = buildAiWorkoutPrompt({ allExercises: db, splitDays: 3, scienceWeek, streaks: [{ name: 'Squat', weeks: 4 }] });
    expect(prompt).toContain('WEEK 3');
    expect(prompt).toContain('• Spalle: 10 sets (priority muscle)');
    expect(prompt).toContain('• Petto: 12 sets');
    expect(prompt).toContain('• Weekly frequency: 5 days');
    expect(prompt).not.toContain('10-18 working sets');
    expect(prompt).toContain('• Squat: 4 weeks');
  });

  it('writes the notes in the app language', () => {
    expect(buildAiWorkoutPrompt({ allExercises: db, language: 'en' })).toContain('one short cue in English');
  });
});
