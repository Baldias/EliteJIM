import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ArrowLeft, ChevronRight, Dumbbell, Dna, Info, Download, Upload, ShieldCheck, HardDrive, Check, Clock, Sparkles } from 'lucide-react';
import { exportDataBackup, importDataBackup, formatLastBackupDate, initPersistentStorage } from '../../utils/backup';
import { AiTemplateModal } from '../../components/AiTemplateModal';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  const showScience = useStore(state => state.showScience);
  const toggleScience = useStore(state => state.toggleScience);
  
  const autoBackupEnabled = useStore(state => state.autoBackupEnabled ?? true);
  const autoBackupFrequency = useStore(state => state.autoBackupFrequency || 'after_workout');
  const lastBackupDate = useStore(state => state.lastBackupDate);
  const isStoragePersisted = useStore(state => state.isStoragePersisted);
  const setAutoBackupSettings = useStore(state => state.setAutoBackupSettings);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [persistenceLoading, setPersistenceLoading] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    const success = exportDataBackup();
    if (success) {
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    }
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    importDataBackup(file);
    event.target.value = '';
  };

  const handleRequestStoragePersistence = async () => {
    setPersistenceLoading(true);
    const granted = await initPersistentStorage();
    setPersistenceLoading(false);
    if (granted) {
      alert("Protezione Memoria Locale attivata con successo!");
    } else {
      alert("Il browser non ha concesso la persistenza automatica o non supporta la richiesta manuale.");
    }
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <button className="icon-btn" style={{ background: 'transparent', border: 'none' }} onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <h2>Impostazioni</h2>
        <div style={{ width: 44 }}></div>
      </header>

      <main className="settings-content" style={{ marginTop: '0.5rem' }}>
        <div className="settings-group">
          {/* Card AI Routine & JSON Import */}
          <div 
            className="settings-item clickable" 
            onClick={() => setIsAiModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem', background: 'linear-gradient(135deg, rgba(0, 184, 212, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
              borderRadius: '16px', border: '1px solid rgba(0, 184, 212, 0.25)',
              marginBottom: '1rem', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(0, 184, 212, 0.15)', padding: '8px', borderRadius: '10px' }}>
                <Sparkles size={20} color="#00e5ff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#fff' }}>Crea Scheda con AI & JSON</p>
                  <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#00e5ff', color: '#081018', padding: '1px 6px', borderRadius: '6px', letterSpacing: '0.3px' }}>NUOVO</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Genera prompt per ChatGPT o importa schede da JSON</p>
              </div>
            </div>
            <ChevronRight size={18} color="#00e5ff" />
          </div>

          <div 
            className="settings-item clickable" 
            onClick={() => navigate('/settings/exercises')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem', background: 'rgba(255,255,255,0.03)',
              borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '1rem', cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(var(--primary-color-rgb), 0.1)', padding: '8px', borderRadius: '10px' }}>
                <Dumbbell size={20} color="var(--primary-color)" />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: '700', color: '#fff' }}>Database Esercizi</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gestisci esercizi e gruppi muscolari</p>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>

          <div 
            className="settings-item" 
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem', background: 'rgba(255,255,255,0.03)',
              borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(255, 45, 85, 0.1)', padding: '8px', borderRadius: '10px' }}>
                <Dna size={20} color="#ff2d55" />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: '700', color: '#fff' }}>Sezione Scienza</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Abilita tracker e obiettivi mesociclo</p>
              </div>
            </div>
            <div 
              onClick={toggleScience}
              style={{
                width: '50px', height: '28px', 
                background: showScience ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)',
                borderRadius: '20px', position: 'relative', cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{
                width: '22px', height: '22px', background: '#fff',
                borderRadius: '50%', position: 'absolute', top: '3px',
                left: showScience ? '25px' : '3px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </div>
          </div>
        </div>

        <div className="settings-guide-box" style={{ marginTop: '1.5rem' }}>
          <p className="settings-guide-title">
            <Info size={14} />
            <span>Come funziona la Sezione Scienza?</span>
          </p>
          <p className="settings-guide-text">
            Attivando questa opzione avrai accesso all'analisi del mesociclo, al volume minimo e massimo (MEV/MRV di Mike Israetel) e ai grafici di sovraccarico progressivo. Se preferisci un'esperienza essenziale puoi disattivarla in qualsiasi momento.
          </p>
        </div>

        {/* Sync & Backup Section */}
        <div className="card glass backup-hub-card">
          <div className="backup-hub-header">
            <div className="backup-hub-title-group">
              <div className="backup-hub-icon-box">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="backup-hub-title">
                  Sicurezza & Backup Dati
                </h3>
                <p className="backup-hub-desc">
                  Salva una copia offline per proteggere schede, progressi e XP anche cambiando dispositivo.
                </p>
              </div>
            </div>
            {isStoragePersisted && (
              <span className="backup-storage-pill persisted">
                ● Memoria Protetta
              </span>
            )}
          </div>

          {/* Ultimo Backup & Stato Memoria */}
          <div className="backup-status-panel">
            <div className="backup-status-row">
              <span className="backup-status-label">
                <Clock size={16} /> Ultimo backup:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong className="backup-status-val">
                  {formatLastBackupDate(lastBackupDate)}
                </strong>
                <span className={`backup-status-badge ${lastBackupDate && (Date.now() - lastBackupDate < 7 * 86400000) ? 'is-recent' : 'is-warning'}`}>
                  {lastBackupDate && (Date.now() - lastBackupDate < 7 * 86400000) ? 'Recente' : 'Consigliato'}
                </span>
              </div>
            </div>

            <div className="backup-status-row">
              <span className="backup-status-label">
                <ShieldCheck size={16} /> Archiviazione PWA:
              </span>
              <span className={`backup-storage-pill ${isStoragePersisted ? 'persisted' : 'standard'}`}>
                {isStoragePersisted ? '● Persistente (Protetta)' : '○ Standard'}
              </span>
            </div>

            {!isStoragePersisted && (
              <button
                type="button"
                className="backup-storage-cta"
                onClick={handleRequestStoragePersistence}
                disabled={persistenceLoading}
              >
                <HardDrive size={15} />
                <span>{persistenceLoading ? 'Verifica in corso...' : 'Attiva Protezione Memoria Permanente'}</span>
              </button>
            )}
          </div>

          {/* Impostazioni Promemoria Backup */}
          <div className="backup-reminder-section">
            <div className="backup-reminder-header">
              <div>
                <span className="backup-reminder-title">
                  Promemoria Automatico
                </span>
                <p className="backup-reminder-sub">
                  Mostra un promemoria per salvare i dati
                </p>
              </div>
              <button
                type="button"
                className={`backup-toggle-switch ${autoBackupEnabled ? 'active' : ''}`}
                onClick={() => setAutoBackupSettings({ autoBackupEnabled: !autoBackupEnabled })}
                aria-label="Attiva promemoria automatico"
              >
                <div className="backup-toggle-thumb" />
              </button>
            </div>

            {autoBackupEnabled && (
              <div className="backup-frequency-selector">
                {[
                  { key: 'after_workout', label: 'Fine Workout' },
                  { key: 'weekly', label: 'Settimanale' },
                  { key: 'monthly', label: 'Mensile' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setAutoBackupSettings({ autoBackupFrequency: opt.key })}
                    className={`backup-freq-btn ${autoBackupFrequency === opt.key ? 'active' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Azioni Esporta & Importa */}
          <div className="backup-actions-grid">
            <button 
              type="button"
              className={`backup-btn-export ${exportSuccess ? 'success' : ''}`}
              onClick={handleExport} 
            >
              {exportSuccess ? <Check size={18} /> : <Download size={18} />} 
              <span>{exportSuccess ? 'Scaricato!' : 'Salva Backup'}</span>
            </button>

            <button 
              type="button"
              className="backup-btn-import"
              onClick={() => fileInputRef.current?.click()} 
            >
              <Upload size={18} /> <span>Ripristina</span>
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>

          {/* Mini Guida Salvataggio e Ripristino */}
          <div className="settings-guide-box" style={{ marginTop: '1.25rem' }}>
            <p className="settings-guide-title">Come funziona il salvataggio & ripristino?</p>
            <p className="settings-guide-text">
              1. Clicca su <strong>Salva Backup</strong> per scaricare una copia di sicurezza (.json) sul tuo telefono o computer.<br />
              2. Se cambi telefono o cancelli la cronologia, premi <strong>Ripristina</strong> e seleziona il file: ritroverai subito tutte le tue schede, massimali e livelli XP!
            </p>
          </div>
        </div>
      </main>

      {/* AI Template Modal */}
      <AiTemplateModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
}

export default Settings;
