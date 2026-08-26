import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ArrowLeft, ChevronRight, Dumbbell, Dna, Info, Download, Upload, Zap, ShieldCheck, HardDrive, Check, Clock } from 'lucide-react';
import { EXERCISES_DB } from '../../data/exercises';
import { recalculateTotalXpFromHistory } from '../../utils/gamification';
import { exportDataBackup, importDataBackup, formatLastBackupDate, initPersistentStorage } from '../../utils/backup';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  const showScience = useStore(state => state.showScience);
  const toggleScience = useStore(state => state.toggleScience);
  const syncGamificationWithHistory = useStore(state => state.syncGamificationWithHistory);
  
  const autoBackupEnabled = useStore(state => state.autoBackupEnabled ?? true);
  const autoBackupFrequency = useStore(state => state.autoBackupFrequency || 'after_workout');
  const lastBackupDate = useStore(state => state.lastBackupDate);
  const isStoragePersisted = useStore(state => state.isStoragePersisted);
  const setAutoBackupSettings = useStore(state => state.setAutoBackupSettings);

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

  const loadTestData = () => {
    if (!window.confirm("Attenzione: questo sovrascriverà il tuo storico attuale con dati di test realistici. Sei sicuro?")) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const sessionTemplates = [
      {
        name: 'Spinta (Petto/Spalle/Tricipiti)',
        exercises: [
          { name: 'Panca Piana Bilanciere', sets: 3, baseKg: 60 },
          { name: 'Military Press', sets: 3, baseKg: 35 },
          { name: 'Alzate Laterali Manubri', sets: 3, baseKg: 10 },
          { name: 'Pushdown Tricipiti ai Cavi', sets: 3, baseKg: 20 }
        ]
      },
      {
        name: 'Trazione (Dorso/Bicipiti)',
        exercises: [
          { name: 'Trazioni alla Sbarra (Pull-up)', sets: 3, baseKg: 0 },
          { name: 'Rematore con Bilanciere', sets: 3, baseKg: 50 },
          { name: 'Pulley Basso', sets: 3, baseKg: 45 },
          { name: 'Curl Bilanciere', sets: 3, baseKg: 25 }
        ]
      },
      {
        name: 'Gambe (Leg Day)',
        exercises: [
          { name: 'Squat con Bilanciere', sets: 3, baseKg: 80 },
          { name: 'Leg Extension', sets: 3, baseKg: 50 },
          { name: 'Leg Curl', sets: 3, baseKg: 40 },
          { name: 'Calf Raise Seduto', sets: 3, baseKg: 30 }
        ]
      }
    ];

    const mockHistory = Array.from({ length: 18 }).map((_, i) => {
      const workoutTime = now - (30 - i * 1.6) * day;
      const template = sessionTemplates[i % sessionTemplates.length];
      const progressFactor = Math.floor(i / 3) * 2.5;

      return {
        id: `mock-w-${i}`,
        name: template.name,
        startTime: workoutTime,
        endTime: workoutTime + (45 + Math.random() * 20) * 60 * 1000,
        exercises: template.exercises.map((ex, exIdx) => ({
          id: `mock-ex-${i}-${exIdx}`,
          name: ex.name,
          sets: Array.from({ length: ex.sets }).map((_, sIdx) => ({
            id: Date.now() + i + exIdx + sIdx,
            kg: String(ex.baseKg > 0 ? ex.baseKg + Math.floor(progressFactor) : 0),
            reps: String(8 + (sIdx % 2)),
            done: true
          }))
        }))
      };
    });

    const newHistory = mockHistory.reverse();
    const { userXP, muscleXP, currentStreak, highestStreak } = recalculateTotalXpFromHistory(newHistory, [...EXERCISES_DB, ...(useStore.getState().customExercises || [])]);

    useStore.setState({ 
      history: newHistory,
      userXP,
      muscleXP,
      currentStreak,
      highestStreak,
      lastWorkoutDate: now - 1 * day
    });

    alert("Dati demo realistici caricati con successo!");
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

        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '2rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 8px' }}>
            <Info size={16} /> Info
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Disattivando la Sezione Scienza, verranno nascosti i tracker del mesociclo e i landmark di Mike Israetel per un'esperienza di tracciamento più semplice.
          </p>
        </div>

        {/* Sync & Backup Section */}
        <div className="card glass data-management" style={{ borderRadius: '24px', marginTop: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="var(--primary-color)" /> Sicurezza & Backup Dati
            </h3>
            {isStoragePersisted && (
              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(52, 199, 89, 0.15)', color: '#34c759', fontWeight: '700', border: '1px solid rgba(52, 199, 89, 0.3)' }}>
                ✓ Memoria Protetta
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
            Salva una copia offline dei tuoi dati per proteggere schede, progressi e XP in caso di cancellazione dell'app.
          </p>

          {/* Ultimo Backup & Stato Memoria */}
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} /> Ultimo backup:
              </span>
              <strong style={{ color: lastBackupDate ? '#fff' : 'var(--text-muted)' }}>
                {formatLastBackupDate(lastBackupDate)}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HardDrive size={15} /> Archiviazione PWA:
              </span>
              <span style={{ color: isStoragePersisted ? '#34c759' : '#ff9500', fontWeight: '700' }}>
                {isStoragePersisted ? 'Persistente (sicura)' : 'Standard'}
              </span>
            </div>

            {!isStoragePersisted && (
              <button
                onClick={handleRequestStoragePersistence}
                disabled={persistenceLoading}
                style={{
                  marginTop: '4px',
                  background: 'rgba(255,149,0,0.1)',
                  border: '1px solid rgba(255,149,0,0.25)',
                  color: '#ff9500',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {persistenceLoading ? 'Verifica in corso...' : '🔒 Attiva Protezione Memoria Permanente'}
              </button>
            )}
          </div>

          {/* Impostazioni Promemoria Backup */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
                Promemoria Backup Automatico
              </span>
              <div 
                onClick={() => setAutoBackupSettings({ autoBackupEnabled: !autoBackupEnabled })}
                style={{
                  width: '46px', height: '26px', 
                  background: autoBackupEnabled ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)',
                  borderRadius: '20px', position: 'relative', cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div style={{
                  width: '20px', height: '20px', background: '#fff',
                  borderRadius: '50%', position: 'absolute', top: '3px',
                  left: autoBackupEnabled ? '23px' : '3px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>

            {autoBackupEnabled && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {[
                  { key: 'after_workout', label: 'Fine Workout' },
                  { key: 'weekly', label: 'Settimanale' },
                  { key: 'monthly', label: 'Mensile' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setAutoBackupSettings({ autoBackupFrequency: opt.key })}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      background: autoBackupFrequency === opt.key ? 'rgba(var(--primary-color-rgb), 0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${autoBackupFrequency === opt.key ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)'}`,
                      color: autoBackupFrequency === opt.key ? 'var(--primary-color)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Azioni Esporta & Importa */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
            <button 
              className="btn-primary" 
              onClick={handleExport} 
              style={{ 
                flex: 1, padding: '12px', borderRadius: '12px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                background: exportSuccess ? '#34c759' : 'var(--primary-color)', 
                border: 'none', color: exportSuccess ? '#fff' : '#000', fontWeight: '800' 
              }}
            >
              {exportSuccess ? <Check size={18} /> : <Download size={18} />} 
              {exportSuccess ? 'Scaricato!' : 'Salva Backup'}
            </button>

            <button 
              className="btn-secondary" 
              onClick={() => fileInputRef.current?.click()} 
              style={{ 
                flex: 1, padding: '12px', borderRadius: '12px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' 
              }}
            >
              <Upload size={18} /> Ripristina
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>

          {/* Dati Demo e Sincronizzazione */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn-ghost" 
              onClick={loadTestData} 
              style={{ flex: 1, padding: '10px', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', background: 'transparent' }}
            >
              Dati Demo
            </button>
            <button 
              className="btn-ghost" 
              onClick={() => {
                try {
                  syncGamificationWithHistory();
                  alert("Rank, Livelli e Streak sincronizzati con la cronologia!");
                } catch (err) {
                  console.error("Sync error:", err);
                  alert("Errore durante la sincronizzazione: " + err.message);
                }
              }}
              style={{ flex: 1, padding: '10px', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', background: 'rgba(var(--primary-color-rgb), 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Zap size={14} /> Sincronizza
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;
