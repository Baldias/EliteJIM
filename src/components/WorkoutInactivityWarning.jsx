import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { WORKOUT_AUTO_FINISH_MS, WORKOUT_INACTIVITY_WARNING_MS } from '../utils/workoutInactivity';
import { tr } from '../i18n';

// After a while with no activity, ask whether the workout is still going before
// useWorkoutAutoFinish closes it on its own.
function WorkoutInactivityWarning() {
  const navigate = useNavigate();
  const workoutId = useStore(s => s.activeWorkout?.id);
  const lastActivityAt = useStore(s => s.activeWorkout?.lastActivityAt);
  const keepActive = useStore(s => s.keepWorkoutActive);
  const finish = useStore(s => s.finishWorkout);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!workoutId) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [workoutId, lastActivityAt]);

  if (!workoutId || !Number.isFinite(lastActivityAt)) return null;
  const idle = now - lastActivityAt;
  if (idle < WORKOUT_INACTIVITY_WARNING_MS || idle >= WORKOUT_AUTO_FINISH_MS) return null;
  const minutes = Math.max(1, Math.ceil((WORKOUT_AUTO_FINISH_MS - idle) / 60000));

  const finishNow = () => {
    finish();
    navigate('/recap');
  };

  return (
    <div className="pwa-toast wk-idle-toast" role="alertdialog" aria-live="assertive">
      <div className="pwa-message">
        <span>
          <strong>{tr('Stai ancora allenandoti?')}</strong>{' '}
          {tr("Nessuna attività da {idle} min: l'allenamento si chiuderà da solo tra {minutes} min.", { idle: Math.floor(idle / 60000), minutes })}
        </span>
      </div>
      <div className="pwa-buttons">
        <button type="button" className="pwa-btn pwa-btn-reload" onClick={() => keepActive()}>
          {tr('Sto continuando')}
        </button>
        <button type="button" className="pwa-btn pwa-btn-close" onClick={finishNow}>
          {tr('Termina ora')}
        </button>
      </div>
    </div>
  );
}

export default WorkoutInactivityWarning;
