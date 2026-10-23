import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { getAllExercises } from '../src/data/exercises';
import { beginnerStartCorrection, createScienceProgram, emptyScienceState } from '../src/utils/scienceV3';

const start=new Date(2026,9,19).getTime(), day=86400000;
const db=getAllExercises([],{});
const profile={experience:'beginner',daysPerWeek:4,minutesPerSession:90,goal:'balanced',priorities:[],startDate:start};
const history=[1,2].map(w=>({id:w,startTime:start-w*7*day+1000,exercises:[{id:'back',name:'Rematore con Bilanciere',sets:Array.from({length:22},(_,id)=>({id,kg:40,reps:10,done:true}))},{id:'shoulder',name:'Alzate Laterali Manubri',sets:Array.from({length:14},(_,id)=>({id,kg:5,reps:12,done:true}))}]}));
const original=useStore.getInitialState();
beforeEach(()=>useStore.setState({...original,history:structuredClone(history),scienceState:emptyScienceState()},true));

describe('experience references blended with bounded historical evidence',()=>{
  it('does not turn 22 back and 14 shoulder logged sets into beginner starting targets',()=>{
    const before=structuredClone(history);
    const science=createScienceProgram(profile,history,db,emptyScienceState(),null,start);
    expect(science.program.targets.Dorso).toBe(8);
    expect(science.program.targets.Spalle).toBe(6);
    expect(science.program.initialEstimates.Dorso).toMatchObject({referenceDose:6,historyMedian:22,historyWeight:.15,reliable:false});
    expect(science.program.landmarks.Dorso.mrv).toBeNull();
    expect(history).toEqual(before);
  });
  it('lets history contribute without replacing the reference and gives reliable evidence more weight',()=>{
    const loose=createScienceProgram({...profile,experience:'advanced'},history,db,emptyScienceState(),null,start);
    const tracked=emptyScienceState();
    for(const w of history){
      tracked.annotations[w.id]=Object.fromEntries(w.exercises.map(e=>[e.id,Object.fromEntries(e.sets.map(s=>[s.id,{rir:1}]))]));
      tracked.feedback[w.id]={muscles:{Dorso:{quality:'good',recovery:'good'},Spalle:{quality:'good',recovery:'good'}}};
    }
    const reliable=createScienceProgram({...profile,experience:'advanced'},history,db,tracked,null,start);
    expect(loose.program.targets.Dorso).toBe(16);
    expect(reliable.program.targets.Dorso).toBe(18);
    expect(reliable.program.initialEstimates.Dorso.historyWeight).toBe(.6);
    expect(reliable.program.targets.Dorso).toBeLessThan(22);
    const fresh=createScienceProgram(profile,[],db,emptyScienceState(),null,start);
    expect(fresh.program.targets.Dorso).toBe(6);
    expect(fresh.program.targets.Spalle).toBe(4);
  });
  it('offers correction for an existing erroneous start only after acceptance and preserves the entire protocol and XP',()=>{
    const science=createScienceProgram(profile,history,db,emptyScienceState(),null,start);
    delete science.program.startingDoseVersion;
    science.program.targets.Dorso=22;science.program.targets.Spalle=14;
    science.program.initialTargets={...science.program.targets};
    useStore.setState({scienceState:science,userXP:1500,muscleXP:{Dorso:200},currentStreak:3});
    expect(beginnerStartCorrection(science,history,db,null,start).changes).toContainEqual({muscle:'Dorso',before:22,after:8});
    expect(useStore.getState().scienceState.program.targets.Dorso).toBe(22);
    const before=JSON.stringify(Object.fromEntries(['history','userXP','muscleXP','currentStreak','highestStreak','scienceReport'].map(k=>[k,useStore.getState()[k]])));
    useStore.getState().respondBeginnerStartCorrection(true,start);
    const after=useStore.getState();
    expect(after.scienceState.program.targets.Dorso).toBe(8);
    expect(after.scienceState.program.targets.Spalle).toBe(6);
    expect(after.scienceState.program.id).toBe(science.program.id);
    expect(after.scienceState.program.currentWeek).toBe(1);
    expect(after.scienceState.program.startDate).toBe(start);
    expect(JSON.stringify(Object.fromEntries(['history','userXP','muscleXP','currentStreak','highestStreak','scienceReport'].map(k=>[k,after[k]])))).toBe(before);
    const stable=after.scienceState;
    useStore.getState().respondBeginnerStartCorrection(true,start+1);
    expect(useStore.getState().scienceState).toBe(stable);
  });
  it('honors rejection, manual targets and later weeks',()=>{
    const science=createScienceProgram(profile,history,db,emptyScienceState(),null,start);
    delete science.program.startingDoseVersion;
    science.program.targets.Dorso=22;science.program.initialTargets.Dorso=22;
    useStore.setState({scienceState:science});
    useStore.getState().respondBeginnerStartCorrection(false,start);
    expect(useStore.getState().scienceState.program.targets.Dorso).toBe(22);
    expect(beginnerStartCorrection(useStore.getState().scienceState,history,db,null,start)).toBeNull();
    science.program.decisions.Dorso='Obiettivo impostato da te.';
    expect(beginnerStartCorrection(science,history,db,null,start)).toBeNull();
    science.program.decisions={};science.program.currentWeek=2;
    expect(beginnerStartCorrection(science,history,db,null,start)).toBeNull();
  });
});
