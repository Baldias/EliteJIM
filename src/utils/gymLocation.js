import { normalizeName } from '../data/exercises';
import { getLanguage, tr } from '../i18n';

export const GYM_LOCATION_INTRO_VERSION = 1;
export const isMachineExercise = (name, db) => db.find(ex => normalizeName(ex.name) === normalizeName(name))?.equipmentType === 'machine';
export const locationKey = workout => workout?.gymLocation?.id || 'unlocated';
export function machineHistory(history, name, db, workout) {
  if (!workout?.machineLocationScoped || !isMachineExercise(name, db)) return history;
  if (!workout.gymLocation) return [];
  return history.filter(previous => locationKey(previous) === locationKey(workout));
}
export const gymLabel = (location, aliases = {}) => location ? aliases[location.id] || location.name : tr('Località non disponibile');

export function cityFromGeocode(data) {
  const name = String(data.city || data.locality || '').trim();
  if (!name || !data.countryCode) throw new Error(tr('Comune non riconosciuto.'));
  const region = String(data.principalSubdivisionCode || data.principalSubdivision || '');
  return { id: [data.countryCode, region, name].map(normalizeName).join(':'), name, region, country: data.countryCode };
}

// Only live device coordinates are sent to the client-side geocoding service.
// No IP fallback, coordinate persistence, background tracking or watchPosition.
let pending;
export function detectGymCity() {
  if (pending) return pending;
  pending = (async () => {
    if (!navigator.geolocation) throw new Error(tr('Posizione non supportata su questo dispositivo.'));
    const coords = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      error => reject(new Error(error.code === 1 ? tr('Accesso alla posizione negato. Puoi continuare senza località.') : tr('Posizione non disponibile. Riprova quando hai segnale.'))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    ));
    const query = new URLSearchParams({ latitude: coords.latitude.toFixed(5), longitude: coords.longitude.toFixed(5), localityLanguage: getLanguage() });
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`, { signal: AbortSignal.timeout(8000), credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(tr('Impossibile riconoscere il comune. Riprova più tardi.'));
    return cityFromGeocode(await response.json());
  })().finally(() => { pending = null; });
  return pending;
}
