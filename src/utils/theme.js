export const SCIENCE_GLOWS = [
  { id:'gold', name:'Oro', rgb:'230, 207, 0' },
  { id:'blue', name:'Azzurro', rgb:'0, 180, 230' },
  { id:'purple', name:'Viola', rgb:'168, 85, 247' },
  { id:'pink', name:'Rosa', rgb:'236, 72, 153' },
  { id:'green', name:'Verde', rgb:'48, 209, 88' },
];
export const THEMES = ['og', 'science-v3'];
export function themePreferences(saved) {
  if (!saved) return { theme: 'science-v3', themeChosen: false, scienceGlow:'gold' };
  return { theme: THEMES.includes(saved.theme) ? saved.theme : 'science-v3', themeChosen: typeof saved.themeChosen === 'boolean' ? saved.themeChosen : true, scienceGlow:SCIENCE_GLOWS.some(g=>g.id===saved.scienceGlow) ? saved.scienceGlow : 'gold' };
}
export function bindTheme(store, element = document.documentElement) {
  const apply = () => { const prefs=themePreferences(store.getState()); element.dataset.theme=prefs.theme; element.dataset.scienceGlow=prefs.scienceGlow; };
  apply();
  return store.subscribe((state, previous) => { if (state.theme !== previous.theme || state.scienceGlow !== previous.scienceGlow) apply(); });
}
