// Only fresh installs start with optional features off. Existing stores/backups
// keep their choices and the sections they already had access to.
export function existingFeaturePreferences(saved) {
  if (!saved) return {};
  return {
    showScience: typeof saved.showScience === 'boolean' ? saved.showScience : true,
    showDiary: typeof saved.showDiary === 'boolean' ? saved.showDiary : true,
  };
}
