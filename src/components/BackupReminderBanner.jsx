import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { ShieldCheck, Download, Check, FileCheck } from 'lucide-react';
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
      }, 3000);
    }
  };

  const handleSnooze = (e) => {
    e.stopPropagation();
    snoozeBackupReminder(48); // Snooze for 48 hours
  };

  return (
    <div className={`backup-banner-container ${savedSuccess ? 'is-success' : ''}`}>
      <div className="backup-banner-accent-bar" />
      <div className="backup-banner-header">
        <div className="backup-banner-info">
          <div className="backup-banner-icon">
            {savedSuccess ? <Check size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div>
            <h4 className="backup-banner-title">
              {savedSuccess ? 'Backup Salvato!' : 'Proteggi i tuoi Dati'}
              <span className="backup-banner-badge">EliteJIM_Backup.json</span>
            </h4>
            <p className="backup-banner-desc">
              {savedSuccess 
                ? 'File scaricato e aggiornato sul tuo dispositivo.'
                : 'Salva una copia offline per non perdere mai schede e XP.'}
            </p>
          </div>
        </div>
      </div>

      {!savedSuccess && (
        <div className="backup-banner-actions">
          <button className="backup-banner-btn-save" onClick={handleQuickBackup}>
            <Download size={17} /> Salva Backup (1 tap)
          </button>
          <button className="backup-banner-btn-later" onClick={handleSnooze}>
            Più tardi
          </button>
        </div>
      )}
    </div>
  );
}
