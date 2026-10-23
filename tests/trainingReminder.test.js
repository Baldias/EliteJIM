import { beforeEach, describe, expect, it } from 'vitest';
import { acknowledgeTrainingReminder, emptyTrainingReminder, isTrainingRecovery, reminderDue } from '../src/utils/trainingReminder';
import { useStore } from '../src/store/useStore';
import { normalizeBackupPayload } from '../src/utils/backup';

const original = useStore.getInitialState();
const start = new Date(2026,9,23,10).getTime();
const after = (days) => { const d=new Date(start); d.setDate(d.getDate()+days); return d.getTime(); };
beforeEach(()=>useStore.setState({...original,trainingReminder:emptyTrainingReminder()},true));

describe('working-set reminder with spaced confirmations',()=>{
  it('shows at most three confirmed exposures, spaced by two then seven calendar days',()=>{
    let state=emptyTrainingReminder();
    expect(reminderDue(state,{id:1},start)).toBe(true);
    state=acknowledgeTrainingReminder(state,{id:1},start);
    expect(state.nextAt).toBe(after(2));
    expect(reminderDue(state,{id:2},after(1))).toBe(false);
    expect(reminderDue(state,{id:2},after(2))).toBe(true);
    state=acknowledgeTrainingReminder(state,{id:2},after(2));
    expect(state.nextAt).toBe(after(9));
    expect(reminderDue(state,{id:3},after(8))).toBe(false);
    state=acknowledgeTrainingReminder(state,{id:3},after(10));
    expect(state.confirmations).toHaveLength(3);
    expect(reminderDue(state,{id:4},after(100))).toBe(false);
  });
  it('does not count repeat clicks, reopening the same workout, recovery or missing workouts',()=>{
    const state=acknowledgeTrainingReminder(emptyTrainingReminder(),{id:1},start);
    expect(acknowledgeTrainingReminder(state,{id:1},after(9))).toBe(state);
    expect(acknowledgeTrainingReminder(state,{id:2},after(1))).toBe(state);
    expect(acknowledgeTrainingReminder(state,{id:2},after(9),true)).toBe(state);
    expect(reminderDue(state,null,after(9))).toBe(false);
  });
  it('distinguishes an accepted deload from a merely proposed fifth week',()=>{
    const state={scienceReport:null,scienceState:{program:{status:'active',currentWeek:5,recommendations:[{type:'deload',status:'pending',appliedWeek:5}]}}};
    expect(isTrainingRecovery(state)).toBe(false);
    state.scienceState.program.recommendations[0].status='accepted';
    expect(isTrainingRecovery(state)).toBe(true);
    state.scienceState.program.currentWeek=4;
    expect(isTrainingRecovery(state)).toBe(false);
    state.scienceReport={status:'active',currentWeek:9};
    expect(isTrainingRecovery(state)).toBe(true);
  });
  it('persists confirmations independently of history, science, XP and backups',()=>{
    useStore.setState({activeWorkout:{id:1,exercises:[],startTime:start},userXP:1234,currentStreak:5});
    const before=JSON.stringify(Object.fromEntries(['history','activeWorkout','userXP','muscleXP','scienceState','currentStreak','highestStreak'].map(k=>[k,useStore.getState()[k]])));
    useStore.getState().acknowledgeTrainingReminder(start);
    useStore.getState().acknowledgeTrainingReminder(start);
    const state=useStore.getState();
    expect(state.trainingReminder.confirmations).toHaveLength(1);
    expect(JSON.stringify(Object.fromEntries(['history','activeWorkout','userXP','muscleXP','scienceState','currentStreak','highestStreak'].map(k=>[k,state[k]])))).toBe(before);
    expect(normalizeBackupPayload({history:[]}).state.trainingReminder).toEqual(emptyTrainingReminder());
    expect(normalizeBackupPayload({state:{trainingReminder:state.trainingReminder}}).state.trainingReminder).toEqual(state.trainingReminder);
  });
});
