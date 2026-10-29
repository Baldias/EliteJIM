import { beforeEach, describe, expect, it } from 'vitest';
import { getAllExercises } from '../src/data/exercises';
import { useStore } from '../src/store/useStore';
import { createScienceProgram, currentScienceSummary, emptyScienceState, hasLegacyScience, scienceVolumes } from '../src/utils/scienceV3';
import { migrateLegacyScience, scienceScoringReport } from '../src/utils/scienceMigration';
import { scienceCompletedSets, scienceUnconfirmedSets } from '../src/utils/scienceCarry';
import { scienceSessionGuidance } from '../src/utils/sciencePlanning';
import { buildProgressReport } from '../src/utils/progressReport';
import { scienceTrackingEnabled } from '../src/utils/scienceEvolution';
import { normalizeBackupPayload } from '../src/utils/backup';
import { calculateSessionScore } from '../src/utils/gamification';

const start=new Date(2026,9,12).getTime(),day=86400000,now=start+16*day,db=getAllExercises([],{});
const legacy=(week=3)=>({timestamp:start,startDate:start,status:'active',currentWeek:week,currentWeekStartDate:start+(week-1)*7*day,experienceLevel:'intermediate',gender:'male',daysPerWeek:5,focus1:['Petto'],focus2:['Dorso'],baseLandmarks:{Petto:{mev:10,mav:16,mrv:22},Dorso:{mev:10,mav:18,mrv:25},Glutei:{mev:4,mav:10,mrv:16}},weekHistory:{1:{startDate:start,completedDate:start+7*day},2:{startDate:start+7*day,completedDate:start+14*day}}});
const workout=(id,time)=>({id,startTime:time,endTime:time+3600000,exercises:[{id:'e',name:'Panca Piana Bilanciere',sets:[{id:'s',kg:60,reps:10,done:true},{id:'warm',kg:20,reps:10,done:true,isWarmup:true},{id:'drop',kg:40,reps:10,done:true,isDropset:true},{id:'rest',kg:60,reps:3,done:true,isRestPause:true}]}]});
const history=()=>[workout('w1',start+day),workout('w2',start+8*day),workout('current',start+15*day)];
const original=useStore.getInitialState();
beforeEach(()=>useStore.setState({...original,history:history(),scienceReport:legacy(),scienceState:emptyScienceState(),userXP:2000,muscleXP:{Petto:300},currentStreak:3},true));

describe('immediate V2 to V3 migration',()=>{
  it('carries current and archived ordinary series without fabricating RIR; all V3 views agree',()=>{
    const report=legacy(),logs=history(),before=structuredClone(logs);
    const science=migrateLegacyScience(emptyScienceState(),report,logs,db,now);
    expect(science.program.currentWeek).toBe(3);
    expect(science.program.weekStarts[3]).toBe(report.currentWeekStartDate);
    expect(science.program.targets.Petto).toBeGreaterThan(0);
    expect(science.program.targets).not.toHaveProperty('Glutei');
    expect(science.legacyMigration.snapshots[1].targets).toHaveProperty('Glutei');
    expect(science.program.weeks.map(w=>w.week)).toEqual([1,2]);
    expect(science.program.weeks[0].volumes.muscles.Petto).toMatchObject({direct:0,imported:1,unknown:1});
    const summary=currentScienceSummary(logs,db,science,now);
    expect(summary.muscles.Petto).toMatchObject({direct:0,imported:1,unknown:1});
    expect(scienceCompletedSets(summary.muscles.Petto)).toBe(1);
    expect(scienceUnconfirmedSets(summary.muscles.Petto)).toBe(0);
    const state={...useStore.getState(),scienceState:science,history:logs};
    const shared=buildProgressReport(state,now,{includeScience:true});
    expect(shared.science.accounting).toBe('v3');expect(shared.science.weeks).toHaveLength(5);
    expect(shared.science.rows.find(r=>r.name==='Petto')).toMatchObject({done:1,unknown:0,imported:1});
    expect(scienceSessionGuidance(science,logs,db,now).missingMuscles.find(r=>r.muscle==='Petto').remaining).toBe(science.program.targets.Petto-1);
    expect(science.annotations).toEqual({});expect(logs).toEqual(before);
    expect(hasLegacyScience(report,science)).toBe(false);
  });
  it('counts imported work exactly once when subsequently annotated, and also counts new work without RIR',()=>{
    const logs=history(),science=migrateLegacyScience(emptyScienceState(),legacy(),logs,db,now);
    science.annotations.current={e:{s:{rir:0}}};
    logs.push(workout('new',now+day));
    const v=currentScienceSummary(logs,db,science,now+2*day).muscles.Petto;
    expect(v).toMatchObject({direct:1,unknown:1});expect(v.imported || 0).toBe(0);
    expect(scienceCompletedSets(v)).toBe(2);
    science.annotations.current.e.s.excluded=true;
    expect(scienceCompletedSets(currentScienceSummary(logs,db,science,now+2*day).muscles.Petto)).toBe(1);
  });
  it('is idempotent after backup restore, preserves the original report and never changes gamification',()=>{
    const before=structuredClone(Object.fromEntries(['history','scienceReport','userXP','muscleXP','currentStreak','highestStreak','templates'].map(k=>[k,useStore.getState()[k]])));
    useStore.getState().completeScienceEvolution(now);
    const once=useStore.getState().scienceState;
    useStore.getState().completeScienceEvolution(now+1);expect(useStore.getState().scienceState).toBe(once);
    const restored=normalizeBackupPayload(JSON.parse(JSON.stringify({scienceState:once}))).state.scienceState;
    expect(migrateLegacyScience(restored,legacy(),history(),db,now+2)).toBe(restored);
    expect(Object.fromEntries(Object.keys(before).map(k=>[k,useStore.getState()[k]]))).toEqual(before);
  });
  it('migrates users who already saw the earlier introduction and preserves longer actual weeks',()=>{
    const report=legacy();report.weekHistory[1].completedDate=start+9*day;
    report.weekHistory[2]={startDate:start+9*day,completedDate:start+16*day};report.currentWeekStartDate=start+16*day;
    const state={...emptyScienceState(),releaseV3:{seenAt:start}};
    const log=workout('late',start+8*day);
    const science=migrateLegacyScience(state,report,[log],db,now+day);
    expect(science.program.weeks[0].end).toBe(start+9*day);
    expect(science.program.weeks[0].volumes.muscles.Petto.imported).toBe(1);
    expect(science.program.weeks[1].volumes.muscles.Petto.ordinary).toBe(0);
    expect(science.releaseV3.seenAt).toBe(start);
  });
  it('maps the second old accumulation block to its matching current week and imports its prior progress',()=>{
    const report=legacy(6),time=start+37*day;
    const science=migrateLegacyScience(emptyScienceState(),report,[workout('old',start+30*day),workout('live',start+36*day)],db,time);
    expect(science.program.currentWeek).toBe(2);expect(science.program.migration.sourceWeek).toBe(6);
    expect(science.program.weeks).toHaveLength(1);
    expect(science.program.weeks[0].volumes.muscles.Petto.imported).toBe(1);
    expect(currentScienceSummary([workout('live',start+36*day)],db,science,time).muscles.Petto.imported).toBe(1);
  });
  it('preserves ongoing recovery and identical score, without reducing a second time',()=>{
    const report=legacy(9),time=start+58*day,logs=[workout('recovery',time-1000)];
    const science=migrateLegacyScience(emptyScienceState(),report,logs,db,time);
    expect(science.program.currentWeek).toBe(5);
    expect(science.program.recommendations[0]).toMatchObject({status:'accepted',appliedWeek:5,choice:'imported'});
    const scoring=scienceScoringReport({scienceReport:report,scienceState:science});
    expect(calculateSessionScore(logs[0],[],db,scoring,80)).toEqual(calculateSessionScore(logs[0],[],db,report,80));
    science.program.status='completed';
    expect(scienceScoringReport({scienceReport:report,scienceState:science}).status).toBe('completed');
    expect(scienceTrackingEnabled({scienceReport:report,scienceState:science})).toBe(false);
  });
  it('keeps pending protocols pending until explicitly started and never overwrites an existing V3 program',()=>{
    useStore.setState({scienceReport:{...legacy(1),status:'pending'}});
    useStore.getState().completeScienceEvolution(now);
    expect(useStore.getState().scienceState.program.status).toBe('pending');
    useStore.getState().startImportedScience(now,now);
    expect(useStore.getState().scienceState.program.status).toBe('active');
    const existing=createScienceProgram({experience:'advanced',goal:'balanced',priorities:[],daysPerWeek:5,minutesPerSession:90,startDate:start},[],db,emptyScienceState(),null,start);
    const migrated=migrateLegacyScience(existing,legacy(),history(),db,now);
    expect(migrated.program).toBe(existing.program);expect(hasLegacyScience(legacy(),migrated)).toBe(false);
  });
  it('retains the old first-week pre-start buffer only for already-imported series, with stable fallback identities',()=>{
    const report=legacy(1),logs=[workout('buffer',start-3600000)];
    delete logs[0].id;delete logs[0].exercises[0].id;delete logs[0].exercises[0].sets[0].id;
    const science=migrateLegacyScience(emptyScienceState(),report,logs,db,start+day);
    expect(currentScienceSummary(logs,db,science,start+day).muscles.Petto.imported).toBe(1);
    logs.push(workout('not-imported',start-2000));
    expect(currentScienceSummary(logs,db,science,start+day).muscles.Petto.ordinary).toBe(1);
    expect(scienceVolumes(logs,db,science,start+7*day,start+14*day).muscles.Petto.ordinary).toBe(0);
  });
});
