import { GymLocationSettings } from '../../components/GymLocation';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ChevronLeft, ChevronRight, Utensils, Dumbbell, Dna, Download, Upload, ShieldCheck, HardDrive, Check, Clock, Bell, Weight, CookingPot } from 'lucide-react';
import { exportDataBackup, importDataBackup, formatLastBackupDate, initPersistentStorage } from '../../utils/backup';
import { ThemeSettingRow } from '../../components/ThemePicker';
import { LanguageSettingRow } from '../../components/LanguagePicker';
import { sanitizeDecimalInput } from '../../utils/number';
import { REFERENCE_BODYWEIGHT_KG } from '../../utils/oneRepMax';
import './Settings.css';
import ScienceDebugEntry from './ScienceDebug';
import ScienceTutorialButton from '../science/ScienceTutorial';
import { tr } from '../../i18n';

function Settings() {
  const navigate = useNavigate();
  const showScience = useStore(state => state.showScience);
  const toggleScience = useStore(state => state.toggleScience);
  const showDiary = useStore(state => state.showDiary);
  const toggleDiary = useStore(state => state.toggleDiary);
  
  const autoBackupEnabled = useStore(state => state.autoBackupEnabled ?? true);
  const autoBackupFrequency = useStore(state => state.autoBackupFrequency || 'after_workout');
  const lastBackupDate = useStore(state => state.lastBackupDate);
  const isStoragePersisted = useStore(state => state.isStoragePersisted);
  const setAutoBackupSettings = useStore(state => state.setAutoBackupSettings);
  const bodyweight = useStore(state => state.bodyweight);
  const quizBodyweight = useStore(state => parseFloat(state.scienceReport?.inputStats?.bw) || null);
  const setBodyweight = useStore(state => state.setBodyweight);

  const [exportSuccess, setExportSuccess] = useState(false);
  const [persistenceLoading, setPersistenceLoading] = useState(false);
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
      alert(tr('Protezione Memoria Locale attivata con successo!'));
    } else {
      alert(tr('Il browser non ha concesso la persistenza automatica o non supporta la richiesta manuale.'));
    }
  };

  const backupIsRecent = lastBackupDate && (mountedAt - lastBackupDate < 7 * 86400000);

  return (
    <div className="ej-page st-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="st-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round st-back" onClick={() => navigate(-1)} title={tr('Indietro')}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="st-title">{tr('Impostazioni')}</h1>
      </header>

      {/* Navigation rows */}
      <div className="st-rows">
        <ThemeSettingRow />
        <LanguageSettingRow />

        <button type="button" className="ej-card st-row" onClick={() => navigate('/settings/exercises')}>
          <span className="st-row-icon is-primary"><Dumbbell size={20} /></span>
          <span className="st-row-text">
            <span className="st-row-title">{tr('Database Esercizi')}</span>
            <span className="st-row-sub">{tr('Gestisci esercizi e gruppi muscolari')}</span>
          </span>
          <ChevronRight size={18} className="st-row-chevron" />
        </button>

        {showDiary && (
          <button type="button" className="ej-card st-row" onClick={() => navigate('/settings/pasti')}>
            <span className="st-row-icon is-primary"><CookingPot size={20} /></span>
            <span className="st-row-text">
              <span className="st-row-title">{tr('Crea il tuo pasto')}</span>
              <span className="st-row-sub">{tr('Componi e salva pasti da aggiungere al Diario')}</span>
            </span>
            <ChevronRight size={18} className="st-row-chevron" />
          </button>
        )}

        <label className="ej-card st-row">
          <span className="st-row-icon is-primary"><Weight size={20} /></span>
          <span className="st-row-text">
            <span className="st-row-title">{tr('Peso Corporeo')}</span>
            <span className="st-row-sub">
              {tr("Serve per l'1RM di trazioni, dip e piegamenti.")}
              {!bodyweight && ' '}{!bodyweight && (quizBodyweight ? tr('Se vuoto: {kg} kg dal quiz Scienza.', { kg: quizBodyweight }) : tr('Se vuoto: {kg} kg di riferimento.', { kg: REFERENCE_BODYWEIGHT_KG }))}
            </span>
          </span>
          <span className="st-weight">
            <input
              type="text"
              inputMode="decimal"
              value={bodyweightInput}
              onChange={handleBodyweightChange}
              placeholder={String(quizBodyweight || REFERENCE_BODYWEIGHT_KG)}
              aria-label={tr('Peso corporeo in kg')}
            />
            <span>kg</span>
          </span>
        </label>

        <div className="ej-card st-row">
          <span className="st-row-icon is-science"><Dna size={20} /></span>
          <span className="st-row-text">
            <span className="st-row-title">{tr('Sezione Scienza')}</span>
            <span className="st-row-sub">{tr('Abilita tracker e obiettivi mesociclo')}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showScience}
            aria-label={tr('Attiva Sezione Scienza')}
            className={`st-switch ${showScience ? 'is-on' : ''}`}
            onClick={toggleScience}
          >
            <span />
          </button>
        </div>
      </div>

      <div className="ej-card st-row">
        <span className="st-row-icon is-primary"><Utensils size={20} /></span>
        <span className="st-row-text"><span className="st-row-title">{tr('Sezione Diario')}</span><span className="st-row-sub">{tr('Alimentazione e andamento del peso')}</span></span>
        <button type="button" role="switch" aria-checked={showDiary} aria-label={tr('Attiva Sezione Diario')} className={`st-switch ${showDiary ? 'is-on' : ''}`} onClick={toggleDiary}><span /></button>
      </div>
      <div className="st-disclosure"><ScienceTutorialButton inline /></div>

      <GymLocationSettings />
      {/* Sync & Backup */}
      <section className="ej-card st-backup">
        <div className="st-backup-head">
          <span className="st-row-icon is-primary"><ShieldCheck size={20} /></span>
          <div className="st-row-text">
            <h3 className="st-backup-title">{tr('Sicurezza & Backup Dati')}</h3>
            <p className="st-row-sub">{tr('Salva una copia offline per proteggere schede, progressi e XP anche cambiando dispositivo.')}</p>
          </div>
        </div>

        <div className="st-status">
          <div className="st-status-row">
            <span className="st-status-label"><Clock size={15} /> {tr('Ultimo backup:')}</span>
            <span className="st-status-value">
              {formatLastBackupDate(lastBackupDate)}
              <span className={`st-badge ${backupIsRecent ? 'is-good' : 'is-warn'}`}>{backupIsRecent ? tr('Recente') : tr('Consigliato')}</span>
            </span>
          </div>
          <div className="st-status-row">
            <span className="st-status-label"><ShieldCheck size={15} /> {tr('Archiviazione PWA:')}</span>
            <span className={`st-status-value ${isStoragePersisted ? 'is-good' : ''}`}>
              {isStoragePersisted ? tr('Persistente (Protetta)') : 'Standard'}
            </span>
          </div>
          {!isStoragePersisted && (
            <button type="button" className="st-persist-btn" onClick={handleRequestStoragePersistence} disabled={persistenceLoading}>
              <HardDrive size={15} />
              {persistenceLoading ? tr('Verifica in corso...') : tr('Attiva Protezione Memoria Permanente')}
            </button>
          )}
        </div>

        <div className="st-reminder">
          <div className="st-reminder-head">
            <span className="st-status-label"><Bell size={15} /> <span><strong>{tr('Promemoria automatico')}</strong><br /><small>{tr('Mostra un promemoria per salvare i dati')}</small></span></span>
            <button
              type="button"
              role="switch"
              aria-checked={autoBackupEnabled}
              aria-label={tr('Attiva promemoria automatico')}
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
                  {tr(opt.label)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="st-actions">
          <button type="button" className={`st-action is-primary ${exportSuccess ? 'is-done' : ''}`} onClick={handleExport}>
            {exportSuccess ? <Check size={17} /> : <Download size={17} />}
            {exportSuccess ? tr('Scaricato!') : tr('Salva Backup')}
          </button>
          <button type="button" className="st-action" onClick={() => fileInputRef.current?.click()}>
            <Upload size={17} /> {tr('Ripristina')}
          </button>
          <input type="file" accept=".json" ref={fileInputRef} hidden onChange={handleImport} />
        </div>

        <div className="st-guide">
          <p className="st-guide-title">{tr('Come funziona il salvataggio & ripristino?')}</p>
          <p className="st-guide-text">
            {tr('1. Clicca su')} <strong>{tr(tr('Salva Backup'))}</strong> {tr('per scaricare una copia di sicurezza (.json) sul tuo telefono o computer.')}<br />
            {tr('2. Se cambi telefono o cancelli la cronologia, premi')} <strong>{tr('Ripristina')}</strong> {tr('e seleziona il file: ritroverai subito tutte le tue schede, massimali e livelli XP!')}
          </p>
        </div>
      </section>

      <ScienceDebugEntry />
    </div>
  );
}

export default Settings;
