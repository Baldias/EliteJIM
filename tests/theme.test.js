import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/store/useStore';
import { bindTheme, hasCurrentThemeChoice, THEME_SELECTION_VERSION, themePreferences } from '../src/utils/theme';
import { normalizeBackupPayload } from '../src/utils/backup';
const initial = useStore.getInitialState();
afterEach(() => useStore.setState(initial, true));
describe('theme selection and compatibility', () => {
  it('offers the choice once after the update to new and existing users', () => {
    expect(themePreferences()).toEqual({ theme:'science-v3', themeChosen:false, themeChoiceVersion:0, scienceGlow:'gold' });
    expect(themePreferences({ history:[] })).toMatchObject({ theme:'science-v3', themeChosen:false });
    expect(themePreferences({ theme:'og', themeChosen:true })).toMatchObject({ theme:'og', themeChosen:false });
    expect(themePreferences({ theme:'invalid' }).theme).toBe('science-v3');
    expect(useStore.persist.getOptions().merge(undefined, initial).themeChosen).toBe(false);
    expect(useStore.persist.getOptions().merge({ history:[] }, initial).themeChosen).toBe(false);
  });
  it('changes the theme without touching workout, scientific or gamification data', () => {
    const before=JSON.stringify(Object.fromEntries(['history','activeWorkout','templates','scienceState','userXP','muscleXP','currentStreak','highestStreak','foodDiary','weightLog'].map(k=>[k,useStore.getState()[k]])));
    useStore.getState().chooseTheme('og');
    expect(useStore.getState()).toMatchObject({theme:'og',themeChosen:true});
    useStore.getState().chooseTheme('invalid');
    expect(useStore.getState().theme).toBe('og');
    useStore.getState().chooseTheme('science-v3');
    expect(hasCurrentThemeChoice(useStore.getState())).toBe(true);
    expect(hasCurrentThemeChoice(themePreferences(useStore.getState()))).toBe(true);
    expect(hasCurrentThemeChoice({themeChosen:true,themeChoiceVersion:1})).toBe(false);
    const after=JSON.stringify(Object.fromEntries(['history','activeWorkout','templates','scienceState','userXP','muscleXP','currentStreak','highestStreak','foodDiary','weightLog'].map(k=>[k,useStore.getState()[k]])));
    expect(after).toBe(before);
  });
  it('restores the chosen edition and release marker without repeating the selection', () => {
    expect(normalizeBackupPayload({history:[]}).state.themeChosen).toBe(false);
    expect(normalizeBackupPayload({state:{theme:'og',themeChosen:true,themeChoiceVersion:THEME_SELECTION_VERSION}}).state).toMatchObject({theme:'og',themeChosen:true});
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
