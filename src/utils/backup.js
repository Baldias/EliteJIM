import { useStore } from '../store/useStore';

/**
 * Genera e scarica istantaneamente il file JSON di backup di EliteJIM
 * @returns {boolean} true se il download è avvenuto con successo
 */
export function exportDataBackup() {
  try {
    let data = localStorage.getItem('elitejim-storage');
    
    // Fallback: se per qualche motivo il localStorage non è ancora sincronizzato
    if (!data) {
      const currentState = useStore.getState();
      data = JSON.stringify({
        state: {
          templates: currentState.templates || [],
          history: currentState.history || [],
          customExercises: currentState.customExercises || [],
          scienceReport: currentState.scienceReport || null,
          userXP: currentState.userXP || 0,
          muscleXP: currentState.muscleXP || {},
          currentStreak: currentState.currentStreak || 0,
          highestStreak: currentState.highestStreak || 0,
          lastWorkoutDate: currentState.lastWorkoutDate || null,
          showScience: currentState.showScience ?? true,
          autoBackupEnabled: currentState.autoBackupEnabled ?? true,
          autoBackupFrequency: currentState.autoBackupFrequency || 'after_workout',
          lastBackupDate: Date.now()
        },
        version: 0
      });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `EliteJIM_Backup_${dateStr}.json`;

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Registra la data del backup effettuato
    if (useStore.getState().recordBackupExported) {
      useStore.getState().recordBackupExported();
    }

    return true;
  } catch (err) {
    console.error('Errore durante l\'esportazione del backup:', err);
    alert('Errore durante il salvataggio del backup: ' + err.message);
    return false;
  }
}

/**
 * Importa e ripristina un file di backup JSON
 * @param {File} file 
 * @param {Function} onComplete Callback opzionale
 */
export function importDataBackup(file, onComplete) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const parsed = JSON.parse(content);

      if (!parsed || (!parsed.state && !parsed.history && !parsed.templates)) {
        alert('Il file selezionato non sembra essere un backup valido di EliteJIM.');
        return;
      }

      // Normalizza la struttura se proviene da versioni differenti
      const normalizedData = parsed.state ? parsed : { state: parsed, version: 0 };

      if (window.confirm('Attenzione: Importando questo backup sovrascriverai schede, progressi e cronologia attuali. Sei sicuro di voler procedere?')) {
        localStorage.setItem('elitejim-storage', JSON.stringify(normalizedData));
        if (onComplete) {
          onComplete(true);
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Errore durante l\'importazione:', err);
      alert('Errore durante la lettura del file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/**
 * Richiede la persistenza della memoria locale (Persistent Storage API)
 * per evitare che il browser cancelli LocalStorage/IndexedDB quando lo spazio è ridotto.
 */
export async function initPersistentStorage() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      let isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        isPersisted = await navigator.storage.persist();
      }
      if (useStore.getState().setStoragePersisted) {
        useStore.getState().setStoragePersisted(Boolean(isPersisted));
      }
      return Boolean(isPersisted);
    }
  } catch (err) {
    console.warn('Persistent Storage API non supportata o errore:', err);
  }
  return false;
}

/**
 * Formatta un timestamp in una data leggibile per l'utente
 * @param {number|null} timestamp 
 * @returns {string}
 */
export function formatLastBackupDate(timestamp) {
  if (!timestamp) return 'Mai effettuato';

  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (isToday) {
    return `Oggi alle ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Ieri alle ${timeStr}`;
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} alle ${timeStr}`;
}

/**
 * Determina se mostrare il banner o il promemoria di backup
 * @param {Object} state Stato di useStore
 * @returns {boolean}
 */
export function shouldShowBackupBanner(state) {
  if (!state) return false;
  if (state.autoBackupEnabled === false) return false;

  // Se l'utente ha posticipato il promemoria
  if (state.dismissedBackupReminderUntil && Date.now() < state.dismissedBackupReminderUntil) {
    return false;
  }

  const history = state.history || [];
  if (history.length === 0) return false; // Nessun dato importante da proteggere ancora

  const lastBackup = state.lastBackupDate;
  const lastWorkout = state.lastWorkoutDate;
  const freq = state.autoBackupFrequency || 'after_workout';

  if (!lastBackup) {
    return true; // Mai fatto backup e c'è dello storico
  }

  if (freq === 'after_workout') {
    // Se c'è stato un workout dopo l'ultimo backup
    return lastWorkout && lastWorkout > lastBackup;
  }

  if (freq === 'weekly') {
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - lastBackup) > ONE_WEEK;
  }

  if (freq === 'monthly') {
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    return (Date.now() - lastBackup) > ONE_MONTH;
  }

  return false;
}
