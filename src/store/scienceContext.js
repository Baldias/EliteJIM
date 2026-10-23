import { createContext, useContext } from 'react';
import { useStore as useZustandStore } from 'zustand';
import { useStore } from './useStore';

export const ScienceStoreContext = createContext(null);
// The simulator supplies an in-memory store. Outside it every scientific view
// and action uses the existing persisted app store, unchanged.
export function useScienceStore(selector) {
  return useZustandStore(useContext(ScienceStoreContext) || useStore, selector);
}
