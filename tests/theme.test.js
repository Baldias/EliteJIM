import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { bindTheme, themePreferences } from '../src/utils/theme';
import { normalizeBackupPayload } from '../src/utils/backup';
const initial = useStore.getInitialState();
afterEach(() => useStore.setState(initial, true));
describe('theme selection and compatibility', () => {
  it('asks only fresh installs, retaining the current edition for existing users', () => {
    expect(themePreferences()).toEqual({ theme:'science-v3', themeChosen:false, scienceGlow:'gold' });
    expect(themePreferences({ history:[] })).toMatchObject({ theme:'science-v3', themeChosen:true });
    expect(themePreferences({ theme:'og', themeChosen:true })).toMatchObject({ theme:'og', themeChosen:true });
    expect(themePreferences({ theme:'invalid' }).theme).toBe('science-v3');
    expect(useStore.persist.getOptions().merge(undefined, initial).themeChosen).toBe(false);
    expect(useStore.persist.getOptions().merge({ history:[] }, initial).themeChosen).toBe(true);
  });
  it('changes the theme without touching workout, scientific or gamification data', () => {
    const before=JSON.stringify(Object.fromEntries(['history','activeWorkout','templates','scienceState','userXP','muscleXP','currentStreak','highestStreak','foodDiary','weightLog'].map(k=>[k,useStore.getState()[k]])));
    useStore.getState().chooseTheme('og');
    expect(useStore.getState()).toMatchObject({theme:'og',themeChosen:true});
    useStore.getState().chooseTheme('invalid');
    expect(useStore.getState().theme).toBe('og');
    useStore.getState().chooseTheme('science-v3');
    const after=JSON.stringify(Object.fromEntries(['history','activeWorkout','templates','scienceState','userXP','muscleXP','currentStreak','highestStreak','foodDiary','weightLog'].map(k=>[k,useStore.getState()[k]])));
    expect(after).toBe(before);
  });
  it('restores both themes and keeps old backups available without a forced onboarding', () => {
    expect(normalizeBackupPayload({history:[]}).state.themeChosen).toBe(true);
    expect(normalizeBackupPayload({state:{theme:'og',themeChosen:true}}).state).toMatchObject({theme:'og',themeChosen:true});
    expect(normalizeBackupPayload({state:{theme:'science-v3',themeChosen:false}}).state.themeChosen).toBe(false);
  });
  it('updates the document immediately and unsubscribes cleanly', () => {
    const element={dataset:{}};
    const stop=bindTheme(useStore,element);
    useStore.getState().chooseTheme('og');
    expect(element.dataset.theme).toBe('og');
    stop();
    useStore.getState().chooseTheme('science-v3');
    expect(element.dataset.theme).toBe('og');
  });

  it('persists all five glow options, defaults to the current gold and rejects unknown choices', () => {
    for (const glow of ['gold','blue','purple','pink','green']) {
      useStore.getState().chooseTheme('science-v3',glow);
      expect(normalizeBackupPayload({state:useStore.getState()}).state.scienceGlow).toBe(glow);
    }
    useStore.getState().chooseTheme('og','invalid');
    expect(useStore.getState().scienceGlow).toBe('green');
    expect(themePreferences({scienceGlow:'invalid'}).scienceGlow).toBe('gold');
  });

});
