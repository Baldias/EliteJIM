import React, { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useStore } from '../store/useStore';
import { disableWorkoutPush, enableWorkoutPush, isPushSupported, needsHomeScreenInstall } from '../utils/workoutPush';
import { tr } from '../i18n';

const ERRORS = {
  denied: 'Permesso negato: attiva le notifiche per EliteJIM nelle impostazioni del telefono.',
  'not-configured': 'Le notifiche non sono ancora configurate sul server.',
};

// Settings row: push notification after 20 minutes without activity in an open workout.
export function WorkoutPushSettingRow() {
  const enabled = useStore(s => s.workoutPushEnabled ?? false);
  const setEnabled = useStore(s => s.setWorkoutPushEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const installFirst = needsHomeScreenInstall();
  const supported = isPushSupported() && !installFirst;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disableWorkoutPush();
        setEnabled(false);
      } else {
        await enableWorkoutPush();
        setEnabled(true);
      }
    } catch (err) {
      setError(tr(ERRORS[err?.message] || 'Non è stato possibile attivare le notifiche.'));
    } finally {
      setBusy(false);
    }
  };

  const sub = installFirst
    ? tr("Su iPhone aggiungi prima l'app alla schermata Home: le notifiche funzionano solo da lì.")
    : !supported
      ? tr('Questo browser non supporta le notifiche push.')
      : tr("Ti avvisa con una notifica dopo 20 minuti senza attività in un allenamento aperto, anche con l'app chiusa.");

  return (
    <div className="ej-card st-row">
      <span className="st-row-icon is-primary"><BellRing size={20} /></span>
      <span className="st-row-text">
        <span className="st-row-title">{tr('Promemoria allenamento aperto')}</span>
        <span className="st-row-sub">{sub}</span>
        {error && <span className="st-row-sub st-row-error" role="alert">{error}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={tr('Attiva promemoria allenamento aperto')}
        className={`st-switch ${enabled ? 'is-on' : ''}`}
        onClick={toggle}
        disabled={busy || (!supported && !enabled)}
      >
        <span />
      </button>
    </div>
  );
}
