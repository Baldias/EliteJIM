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
      <div className="backup-banner-content">
        <div className="backup-banner-icon-box">
          {savedSuccess ? <Check size={20} className="icon-check" /> : <ShieldCheck size={20} />}
        </div>
        
        <div className="backup-banner-text">
          <div className="backup-banner-header-row">
            <h4 className="backup-banner-title">
              {savedSuccess ? 'Backup completato' : 'Proteggi i tuoi dati'}
            </h4>
            <span className="backup-banner-status-tag">
              {savedSuccess ? 'Salvato' : 'Consigliato'}
            </span>
          </div>
          <p className="backup-banner-desc">
            {savedSuccess 
              ? 'Copia scaricata con successo sul tuo dispositivo.'
              : 'Salva una copia offline per non perdere mai schede, note e XP.'}
          </p>
        </div>
      </div>

      {!savedSuccess && (
        <div className="backup-banner-actions">
          <button className="backup-banner-btn-save" onClick={handleQuickBackup}>
            <Download size={15} /> Salva ora
          </button>
          <button className="backup-banner-btn-later" onClick={handleSnooze}>
            Ricordamelo dopo
          </button>
        </div>
      )}
    </div>
  );
}
