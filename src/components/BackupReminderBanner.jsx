import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { ShieldCheck, Download, Check, X } from 'lucide-react';
import { exportDataBackup, shouldShowBackupBanner } from '../utils/backup';
import './BackupReminderBanner.css';

export function BackupReminderBanner() {
  const store = useStore();
  const snoozeBackupReminder = useStore(state => state.snoozeBackupReminder);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const isVisible = shouldShowBackupBanner(store);

  if (!isVisible && !savedSuccess) {
    return null;
  }

  const handleQuickBackup = () => {
    const success = exportDataBackup();
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 2500);
    }
  };

  const handleSnooze = (e) => {
    e.stopPropagation();
    snoozeBackupReminder(48); // Snooze for 48 hours
  };

  return (
    <div className="backup-banner-container">
      <div className="backup-banner-header">
        <div className="backup-banner-info">
          <div className="backup-banner-icon" style={{ borderColor: savedSuccess ? '#34c759' : undefined }}>
            {savedSuccess ? <Check size={20} color="#34c759" /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <h4 className="backup-banner-title">
              {savedSuccess ? 'Backup Salvato con Successo!' : 'Proteggi i tuoi Progressi'}
            </h4>
            <p className="backup-banner-desc">
              {savedSuccess 
                ? 'I tuoi allenamenti sono al sicuro nel tuo dispositivo.'
                : 'Salva una copia offline dei tuoi dati per non perderli mai.'}
            </p>
          </div>
        </div>
      </div>

      {!savedSuccess && (
        <div className="backup-banner-actions">
          <button className="backup-banner-btn-save" onClick={handleQuickBackup}>
            <Download size={16} /> Salva Backup (1 tap)
          </button>
          <button className="backup-banner-btn-later" onClick={handleSnooze}>
            Più tardi
          </button>
        </div>
      )}
    </div>
  );
}
