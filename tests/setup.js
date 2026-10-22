import { vi } from 'vitest';
import process from 'node:process';

process.env.TZ = 'Europe/Rome';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
}
vi.stubGlobal('localStorage', memoryStorage());
vi.stubGlobal('sessionStorage', memoryStorage());
vi.stubGlobal('window', { location: { search: '', reload: vi.fn() }, confirm: () => true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
vi.stubGlobal('alert', vi.fn());
