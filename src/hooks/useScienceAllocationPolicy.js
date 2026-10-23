import { SCIENCE_REFERENCE_VERSION } from '../utils/scienceReferences';
import { useEffect } from 'react';
import { useScienceStore } from '../store/scienceContext';

export function useScienceAllocationPolicy(now) {
  const program = useScienceStore(s => s.scienceState?.program);
  const gender = useScienceStore(s => s.scienceState?.profile?.gender);
  const update = useScienceStore(s => s.updateScienceVolumeReferences);
  const applyGender = useScienceStore(s => s.applyScienceGenderPolicy);
  useEffect(() => {
    if (gender === 'male' && program?.targets?.Glutei != null) applyGender();
    if (['active','pending'].includes(program?.status) && program.startingDoseVersion !== SCIENCE_REFERENCE_VERSION) update(now);
  }, [program?.id, program?.status, program?.startingDoseVersion, program?.targets?.Glutei, gender, applyGender, update, now]);
}
