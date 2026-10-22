// Demo mode: opened with `?demo` (the public preview link). It runs on a separate
// sessionStorage key preloaded with fake data, so the real data saved in
// localStorage is never read or overwritten. `?demo=off` leaves demo mode.

const FLAG_KEY = 'elitejim-demo-active';
const REAL_STORAGE_KEY = 'elitejim-storage';
const DEMO_STORAGE_KEY = 'elitejim-demo-storage';

const detectDemo = () => {
  if (typeof window === 'undefined') return false;
  try {
    const param = new URLSearchParams(window.location.search).get('demo');
    if (param === 'off' || param === '0') {
      sessionStorage.removeItem(FLAG_KEY);
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
      return false;
    }
    if (param !== null) sessionStorage.setItem(FLAG_KEY, '1');
    return sessionStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
};

export const IS_DEMO = detectDemo();

export const STORAGE_KEY = IS_DEMO ? DEMO_STORAGE_KEY : REAL_STORAGE_KEY;

export const getAppStorage = () => (IS_DEMO ? sessionStorage : localStorage);

export const exitDemo = () => {
  try {
    sessionStorage.removeItem(FLAG_KEY);
    sessionStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // storage unavailable: the reload below still drops the in-memory demo state
  }
  window.location.replace('/');
};
