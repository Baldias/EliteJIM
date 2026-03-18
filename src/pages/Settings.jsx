import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ArrowLeft, ChevronRight, Dumbbell, Dna, Info, Download, Upload, Zap } from 'lucide-react';
import { EXERCISES_DB } from '../data/exercises';
import { recalculateTotalXpFromHistory } from '../utils/gamification';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  const showScience = useStore(state => state.showScience);
  const toggleScience = useStore(state => state.toggleScience);
  const syncGamificationWithHistory = useStore(state => state.syncGamificationWithHistory);
  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    const data = localStorage.getItem('elitejim-storage');
    if (!data) {
      alert("Nessun dato trovato da esportare.");
      return;
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EliteJIM_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsed = JSON.parse(content);
        if (!parsed.state) {
          alert("Il file non sembra essere un backup di EliteJIM valido.");
          return;
        }
        if (window.confirm("Attenzione: Importare questo file sovrascriverà tutte le tue schede e la cronologia attuali. Sei sicuro di voler procedere?")) {
          localStorage.setItem('elitejim-storage', JSON.stringify(parsed));
          window.location.reload();
        }
      } catch (err) {
        alert("Errore durante la lettura del file: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#fff' }}>Sicurezza Dati</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
            Mantieni i tuoi progressi al sicuro esportando il backup o sincronizzando un file esistente.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
            <button className="btn-secondary" onClick={handleExport} style={{ flex: 1, padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
              <Upload size={18} /> Esporta
            </button>

            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--primary-color)', border: 'none', color: '#000', fontWeight: '700' }}>
              <Download size={18} /> Importa
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>

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
                syncGamificationWithHistory();
                alert("Rank, Livelli e Streak sincronizzati con la cronologia!");
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
