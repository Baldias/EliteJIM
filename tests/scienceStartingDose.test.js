import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { getAllExercises } from '../src/data/exercises';
import { createScienceProgram, emptyScienceState } from '../src/utils/scienceV3';
import { SCIENCE_VOLUME_REFERENCES, scienceReference } from '../src/utils/scienceReferences';
import { normalizeBackupPayload } from '../src/utils/backup';

const start=new Date(2026,9,19).getTime(), day=86400000;
const db=getAllExercises([],{});
const profile={experience:'beginner',daysPerWeek:4,minutesPerSession:90,goal:'specialization',priorities:['Petto'],startDate:start};
const history=[1,2].map(w=>({id:w,startTime:start-w*7*day+1000,exercises:[{id:'back',name:'Rematore con Bilanciere',sets:Array.from({length:22},(_,id)=>({id,kg:40,reps:10,done:true}))},{id:'shoulder',name:'Alzate Laterali Manubri',sets:Array.from({length:14},(_,id)=>({id,kg:5,reps:12,done:true}))}]}));
const original=useStore.getInitialState();
const protectedData=s=>structuredClone(Object.fromEntries(['history','activeWorkout','userXP','muscleXP','currentStreak','highestStreak','scienceReport','templates'].map(k=>[k,s[k]])));
beforeEach(()=>useStore.setState({...original,history:structuredClone(history),scienceState:emptyScienceState()},true));

describe('common growth floor and experience-specific accumulation references',()=>{
  it('uses the supplied table at all levels, without silently scaling a normal schedule below MEV',()=>{
    const programs=['beginner','intermediate','advanced'].map(experience=>createScienceProgram({...profile,experience,minutesPerSession:60},[],db,emptyScienceState(),null,start).program);
    for(const p of programs){
      expect(p.targets).toMatchObject({Petto:10,Dorso:10,Quadricipiti:8,Femorali:6,Polpacci:8,Spalle:8,Bicipiti:8,Tricipiti:6});
      for(const [m,n] of Object.entries(p.targets)) expect(n).toBeGreaterThanOrEqual(SCIENCE_VOLUME_REFERENCES[m].mev);
      expect(p.timeRestricted).toBe(false);
      expect(p.timeWarning).toContain('target sono conservati');
      expect(p.landmarks.Spalle.mrv).toBeNull();
    }
    expect(programs.map(p=>p.landmarks.Spalle.mavTarget)).toEqual([16,19,22]);
    expect(programs.map(p=>p.landmarks.Spalle.mrvEstimate)).toEqual([26,28,30]);
    expect(programs.map(p=>p.landmarks.Petto.mevEstimate)).toEqual([10,10,10]);
  });
  it('limits below-MEV scheduling to severe time shortage and explains it',()=>{
    const p=createScienceProgram({...profile,daysPerWeek:1,minutesPerSession:30},[],db,emptyScienceState(),null,start).program;
    expect(p.timeRestricted).toBe(true);
    expect(p.timeWarning).toContain('Forte carenza di tempo');
    expect(Object.values(p.targets).reduce((a,b)=>a+b,0)).toBe(7);
  });
  it('weights high unverified history instead of blindly assigning 22 back/14 shoulder sets to a beginner',()=>{
    const before=structuredClone(history);
    const science=createScienceProgram(profile,history,db,emptyScienceState(),null,start);
    expect(science.program.targets).toMatchObject({Dorso:12,Spalle:9});
    expect(science.program.initialEstimates.Dorso).toMatchObject({referenceDose:10,historyMedian:22,historyWeight:.15,reliable:false});
    expect(history).toEqual(before);
  });
  it('gives reliable historical evidence more weight within the experience reference range',()=>{
    const loose=createScienceProgram({...profile,experience:'advanced'},history,db,emptyScienceState(),null,start);
    const tracked=emptyScienceState();
    for(const w of history){
      tracked.annotations[w.id]=Object.fromEntries(w.exercises.map(e=>[e.id,Object.fromEntries(e.sets.map(s=>[s.id,{rir:1}]))]));
      tracked.feedback[w.id]={muscles:{Dorso:{quality:'good',recovery:'good'},Spalle:{quality:'good',recovery:'good'}}};
    }
    const reliable=createScienceProgram({...profile,experience:'advanced'},history,db,tracked,null,start);
    expect(loose.program.targets.Dorso).toBe(14);
    expect(reliable.program.targets.Dorso).toBe(17);
    expect(reliable.program.initialEstimates.Dorso.historyWeight).toBe(.6);
    expect(reliable.program.targets.Dorso).toBeLessThan(22);
  });
  it.each(['beginner','intermediate','advanced'])('automatically updates an existing %s cycle once, retaining accumulated increments, archives, logs and XP',experience=>{
    const science=createScienceProgram({...profile,experience},history,db,emptyScienceState(),null,start);
    science.program.startingDoseVersion=2;
    science.program.initialTargets.Spalle=4; science.program.targets.Spalle=6;
    science.program.currentWeek=3;
    science.program.weeks=[{week:1,targets:{Spalle:4},volumes:{muscles:{Spalle:{direct:4}}}}];
    const saved=structuredClone(science.program.weeks);
    useStore.setState({scienceState:science,userXP:1500,muscleXP:{Dorso:200},currentStreak:3});
    const before=protectedData(useStore.getState());
    useStore.getState().updateScienceVolumeReferences(start);
    const after=useStore.getState(),p=after.scienceState.program;
    const fresh=createScienceProgram({...profile,experience},history,db,emptyScienceState(),null,start).program;
    expect(p.targets.Spalle).toBe(fresh.targets.Spalle+2);
    expect(p.initialTargets.Spalle).toBe(fresh.targets.Spalle);
    expect(p.currentWeek).toBe(3);expect(p.id).toBe(science.program.id);expect(p.startDate).toBe(start);
    expect(p.weeks).toEqual(saved);expect(protectedData(after)).toEqual(before);
    expect(p.landmarks.Spalle.mavTarget).toBe(scienceReference('Spalle',experience).mavTarget);
    const stable=after.scienceState;
    useStore.getState().updateScienceVolumeReferences(start+1);
    expect(useStore.getState().scienceState).toBe(stable);
    const restored=normalizeBackupPayload(JSON.parse(JSON.stringify({scienceState:stable,history}))).state;
    useStore.setState(restored);useStore.getState().updateScienceVolumeReferences(start+2);
    expect(useStore.getState().scienceState).toBe(restored.scienceState);
  });
  it('keeps accepted recovery and manual targets, updating only their reference landmarks',()=>{
    const science=createScienceProgram(profile,history,db,emptyScienceState(),null,start);
    science.program.startingDoseVersion=2;
    science.program.targets.Dorso=5;
    science.program.recommendations=[{id:'r',type:'recovery',status:'accepted',appliedWeek:1,muscles:['Dorso']}];
    science.program.targets.Spalle=13;science.program.decisions.Spalle='Obiettivo impostato da te.';
    useStore.setState({scienceState:science});useStore.getState().updateScienceVolumeReferences(start);
    const p=useStore.getState().scienceState.program;
    expect(p.targets.Dorso).toBe(5);expect(p.targets.Spalle).toBe(13);
    expect(p.landmarks.Spalle.mevEstimate).toBe(8);
  });
  it('recovers an explicit profile sex from saved data during the forced update and never reintroduces an excluded district through recovery',()=>{
    const science=createScienceProgram(profile,history,db,emptyScienceState(),null,start);
    science.program.startingDoseVersion=2;
    science.program.recommendations=[{id:'old-recovery',type:'recovery',status:'pending',muscles:['Glutei','Dorso']}];
    useStore.setState({scienceState:science,nutritionGoals:{profile:{sex:'male'}}});
    useStore.getState().updateScienceVolumeReferences(start);
    expect(useStore.getState().scienceState.profile.gender).toBe('male');
    expect(useStore.getState().scienceState.program.targets).not.toHaveProperty('Glutei');
    useStore.getState().respondScienceRecovery('old-recovery','reduce',start);
    expect(useStore.getState().scienceState.program.targets).not.toHaveProperty('Glutei');
    expect(Object.values(useStore.getState().scienceState.program.targets).every(Number.isFinite)).toBe(true);
  });
  it('excludes glute targets only for an explicitly male profile, preserving logs and past weeks',()=>{
    const male=createScienceProgram({...profile,gender:'male',goal:'specialization',priorities:['Petto','Glutei']},history,db,emptyScienceState(),null,start);
    expect(male.program.targets).not.toHaveProperty('Glutei');
    expect(male.profile.priorities).toEqual(['Petto']);
    expect(createScienceProgram({...profile,gender:'female'},[],db,emptyScienceState(),null,start).program.targets.Glutei).toBe(4);
    const old=createScienceProgram({...profile,gender:'male'},history,db,emptyScienceState(),null,start);
    old.program.targets.Glutei=8;old.program.weeks=[{week:1,targets:{Glutei:8}}];
    useStore.setState({scienceState:old});const before=protectedData(useStore.getState());
    useStore.getState().applyScienceGenderPolicy();
    expect(useStore.getState().scienceState.program.targets).not.toHaveProperty('Glutei');
    expect(useStore.getState().scienceState.program.weeks[0].targets.Glutei).toBe(8);
    expect(protectedData(useStore.getState())).toEqual(before);
  });
});
