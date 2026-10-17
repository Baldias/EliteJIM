import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ChevronLeft, ChevronRight, ChevronDown, Dumbbell, Dna, Download, Upload, ShieldCheck, HardDrive, Check, Clock, Sparkles, Bell, Weight } from 'lucide-react';
import { exportDataBackup, importDataBackup, formatLastBackupDate, initPersistentStorage } from '../../utils/backup';
import { AiTemplateModal } from '../../components/AiTemplateModal';
import { sanitizeDecimalInput } from '../../utils/number';
import { REFERENCE_BODYWEIGHT_KG } from '../../utils/oneRepMax';
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
  const bodyweight = useStore(state => state.bodyweight);
  const quizBodyweight = useStore(state => parseFloat(state.scienceReport?.inputStats?.bw) || null);
  const setBodyweight = useStore(state => state.setBodyweight);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [persistenceLoading, setPersistenceLoading] = useState(false);
  const [showScienceInfo, setShowScienceInfo] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  const [bodyweightInput, setBodyweightInput] = useState(() => (bodyweight ? String(bodyweight).replace('.', ',') : ''));
  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    const success = exportDataBackup();
    if (success) {
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    }
  };

  const handleBodyweightChange = (event) => {
    const value = sanitizeDecimalInput(event.target.value);
    setBodyweightInput(value);
    setBodyweight(value);
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

  const backupIsRecent = lastBackupDate && (mountedAt - lastBackupDate < 7 * 86400000);

  return (
    <div className="ej-page st-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="st-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round st-back" onClick={() => navigate(-1)} title="Indietro">
          <ChevronLeft size={20} />
        </button>
        <h1 className="st-title">Impostazioni</h1>
      </header>

      {/* Navigation rows */}
      <div className="st-rows">
        <button type="button" className="ej-card st-row" onClick={() => setIsAiModalOpen(true)}>
          <span className="st-row-icon is-ai"><Sparkles size={20} /></span>
          <span className="st-row-text">
            <span className="st-row-title">Crea Scheda con AI &amp; JSON <span className="st-new">Nuovo</span></span>
            <span className="st-row-sub">Genera prompt per ChatGPT o importa schede da JSON</span>
          </span>
          <ChevronRight size={18} className="st-row-chevron" />
        </button>

        <button type="button" className="ej-card st-row" onClick={() => navigate('/settings/exercises')}>
          <span className="st-row-icon is-primary"><Dumbbell size={20} /></span>
          <span className="st-row-text">
            <span className="st-row-title">Database Esercizi</span>
            <span className="st-row-sub">Gestisci esercizi e gruppi muscolari</span>
          </span>
          <ChevronRight size={18} className="st-row-chevron" />
        </button>

        <label className="ej-card st-row">
          <span className="st-row-icon is-primary"><Weight size={20} /></span>
          <span className="st-row-text">
            <span className="st-row-title">Peso Corporeo</span>
            <span className="st-row-sub">
              Serve per l'1RM di trazioni, dip e piegamenti.
              {!bodyweight && (quizBodyweight ? ` Se vuoto: ${quizBodyweight} kg dal quiz Scienza.` : ` Se vuoto: ${REFERENCE_BODYWEIGHT_KG} kg di riferimento.`)}
            </span>
          </span>
          <span className="st-weight">
            <input
              type="text"
              inputMode="decimal"
              value={bodyweightInput}
              onChange={handleBodyweightChange}
              placeholder={String(quizBodyweight || REFERENCE_BODYWEIGHT_KG)}
              aria-label="Peso corporeo in kg"
            />
            <span>kg</span>
          </span>
        </label>

        <div className="ej-card st-row">
          <span className="st-row-icon is-science"><Dna size={20} /></span>
          <span className="st-row-text">
            <span className="st-row-title">Sezione Scienza</span>
            <span className="st-row-sub">Abilita tracker e obiettivi mesociclo</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showScience}
            aria-label="Attiva Sezione Scienza"
            className={`st-switch ${showScience ? 'is-on' : ''}`}
            onClick={toggleScience}
          >
            <span />
          </button>
        </div>
      </div>

      <div className="st-disclosure">
        <button type="button" className="st-disclosure-btn" onClick={() => setShowScienceInfo(v => !v)} aria-expanded={showScienceInfo}>
          Come funziona la Sezione Scienza?
          <ChevronDown size={16} className={showScienceInfo ? 'is-open' : ''} />
        </button>
        {showScienceInfo && (
          <p className="st-disclosure-text">
            Attivando questa opzione avrai accesso all'analisi del mesociclo, al volume minimo e massimo (MEV/MRV di Mike Israetel) e ai grafici di sovraccarico progressivo. Se preferisci un'esperienza essenziale puoi disattivarla in qualsiasi momento.
          </p>
        )}
      </div>

      {/* Sync & Backup */}
      <section className="ej-card st-backup">
        <div className="st-backup-head">
          <span className="st-row-icon is-primary"><ShieldCheck size={20} /></span>
          <div className="st-row-text">
            <h3 className="st-backup-title">Sicurezza &amp; Backup Dati</h3>
            <p className="st-row-sub">Salva una copia offline per proteggere schede, progressi e XP anche cambiando dispositivo.</p>
          </div>
        </div>

        <div className="st-status">
          <div className="st-status-row">
            <span className="st-status-label"><Clock size={15} /> Ultimo backup:</span>
            <span className="st-status-value">
              {formatLastBackupDate(lastBackupDate)}
              <span className={`st-badge ${backupIsRecent ? 'is-good' : 'is-warn'}`}>{backupIsRecent ? 'Recente' : 'Consigliato'}</span>
            </span>
          </div>
          <div className="st-status-row">
            <span className="st-status-label"><ShieldCheck size={15} /> Archiviazione PWA:</span>
            <span className={`st-status-value ${isStoragePersisted ? 'is-good' : ''}`}>
              {isStoragePersisted ? 'Persistente (Protetta)' : 'Standard'}
            </span>
          </div>
          {!isStoragePersisted && (
            <button type="button" className="st-persist-btn" onClick={handleRequestStoragePersistence} disabled={persistenceLoading}>
              <HardDrive size={15} />
              {persistenceLoading ? 'Verifica in corso...' : 'Attiva Protezione Memoria Permanente'}
            </button>
          )}
        </div>

        <div className="st-reminder">
          <div className="st-reminder-head">
            <span className="st-status-label"><Bell size={15} /> <span><strong>Promemoria automatico</strong><br /><small>Mostra un promemoria per salvare i dati</small></span></span>
            <button
              type="button"
              role="switch"
              aria-checked={autoBackupEnabled}
              aria-label="Attiva promemoria automatico"
              className={`st-switch ${autoBackupEnabled ? 'is-on' : ''}`}
              onClick={() => setAutoBackupSettings({ autoBackupEnabled: !autoBackupEnabled })}
            >
              <span />
            </button>
          </div>

          {autoBackupEnabled && (
            <div className="st-segmented">
              {[
                { key: 'after_workout', label: 'Fine Workout' },
                { key: 'weekly', label: 'Settimanale' },
                { key: 'monthly', label: 'Mensile' }
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAutoBackupSettings({ autoBackupFrequency: opt.key })}
                  className={autoBackupFrequency === opt.key ? 'is-active' : ''}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="st-actions">
          <button type="button" className={`st-action is-primary ${exportSuccess ? 'is-done' : ''}`} onClick={handleExport}>
            {exportSuccess ? <Check size={17} /> : <Download size={17} />}
            {exportSuccess ? 'Scaricato!' : 'Salva Backup'}
          </button>
          <button type="button" className="st-action" onClick={() => fileInputRef.current?.click()}>
            <Upload size={17} /> Ripristina
          </button>
          <input type="file" accept=".json" ref={fileInputRef} hidden onChange={handleImport} />
        </div>

        <div className="st-guide">
          <p className="st-guide-title">Come funziona il salvataggio &amp; ripristino?</p>
          <p className="st-guide-text">
            1. Clicca su <strong>Salva Backup</strong> per scaricare una copia di sicurezza (.json) sul tuo telefono o computer.<br />
            2. Se cambi telefono o cancelli la cronologia, premi <strong>Ripristina</strong> e seleziona il file: ritroverai subito tutte le tue schede, massimali e livelli XP!
          </p>
        </div>
      </section>

      <AiTemplateModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
}

export default Settings;
