import { useEffect } from 'react';
import { useScienceStore } from '../store/scienceContext';

export function useScienceAllocationPolicy(now) {
  const program = useScienceStore(s => s.scienceState?.program);
  const adopt = useScienceStore(s => s.adoptScienceAllocation);
  useEffect(() => {
    if (program?.status === 'active' && program.allocationVersion !== 2) adopt(now);
  }, [program?.id, program?.status, program?.allocationVersion, adopt, now]);
}
