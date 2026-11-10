import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from 'react-router-dom';
import { Apple, Check, ChevronLeft, Copy, Download, Dumbbell, MessageSquareText, NotebookPen, Scale, Share2, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ScienceSwitch } from '../../components/ScienceTraining';
import { AI_REPORT_PERIODS, DETAIL_DAYS, buildAiReport } from '../../utils/aiReport';
import { toDateKey } from '../../utils/nutrition';
import './AiReport.css';
import { tr } from '../../i18n';

const FIELDS = ['history', 'customExercises', 'exerciseOverrides', 'weightLog', 'foodDiary', 'nutritionGoals', 'dietSetup', 'bodyweight', 'scienceState', 'scienceReport', 'showScience'];

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export default function AiReport() {
  const navigate = useNavigate();
  const state = useStore(useShallow(s => Object.fromEntries(FIELDS.map(k => [k, s[k]]))));
  const timer = useRef(null);
  const today = toDateKey(new Date());
  const [periodId, setPeriodId] = useState('30d');
  const [custom, setCustom] = useState(() => ({ from: toDateKey(new Date(Date.now() - 29 * 86400000)), to: today }));
  const [include, setInclude] = useState({ workouts: true, notes: true, weight: true, nutrition: true });
  const [prompt, setPrompt] = useState(true);
  const [question, setQuestion] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');

  const report = useMemo(() => buildAiReport(state, { periodId, custom, include, prompt, question }), [state, periodId, custom, include, prompt, question]);
  const tokens = Math.round(report.text.length / 3.5);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const toggle = key => value => setInclude(old => ({ ...old, [key]: value }));
  const flash = text => { setMessage(text); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMessage(''), 3500); };

  const copy = async () => flash(await copyText(report.text) ? tr('Copiato. Ora incollalo nella chat della tua AI.') : tr('Non sono riuscito a copiare: usa Scarica .txt.'));
  const share = async () => {
    try { await navigator.share({ title: tr('Report AI EliteJIM'), text: report.text }); }
    catch (error) { if (error?.name !== 'AbortError') flash(tr('Condivisione non riuscita: usa Copia o Scarica .txt.')); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([report.text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `EliteJIM_Report_AI_${today}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const nothing = !include.workouts && !include.notes && !include.weight && !include.nutrition;

  return (
    <div className="ej-page air-page">
      <div className="ej-glow" aria-hidden="true" />

      <header className="air-header">
        <button type="button" className="ej-icon-btn ej-icon-btn--round air-back" onClick={() => navigate(-1)} aria-label={tr('Torna indietro')}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="air-title">{tr('Report AI')}</h1>
          <p className="air-sub">{tr('I tuoi dati pronti da far analizzare a ChatGPT, Claude o Gemini')}</p>
        </div>
      </header>

      <section className="ej-card air-card">
        <h2 className="air-card-title">{tr('Periodo')}</h2>
        <div className="air-periods" role="radiogroup" aria-label={tr('Periodo')}>
          {AI_REPORT_PERIODS.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={periodId === p.id} className={`ej-chip${periodId === p.id ? ' is-active' : ''}`} onClick={() => setPeriodId(p.id)}>{tr(p.label)}</button>
          ))}
        </div>
        {periodId === 'custom' && (
          <div className="air-dates">
            <label>{tr('Dal')}<input type="date" value={custom.from} max={today} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} /></label>
            <label>{tr('Al')}<input type="date" value={custom.to} max={today} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} /></label>
          </div>
        )}
        {report.detail === 'summary' && <p className="air-hint">{tr('Periodo lungo: le settimane più vecchie sono riassunte, gli ultimi {n} giorni restano serie per serie.', { n: DETAIL_DAYS })}</p>}
      </section>

      <section className="ej-card air-card">
        <h2 className="air-card-title">{tr('Cosa includere')}</h2>
        <div className="air-switches">
          <ScienceSwitch icon={Dumbbell} label={tr('Allenamenti')} description={tr('Serie, carichi, RIR, volume per muscolo e progressi')} checked={include.workouts} onChange={toggle('workouts')} />
          <ScienceSwitch icon={NotebookPen} label={tr('Note di sessione')} description={tr('Quello che hai scritto alla fine degli allenamenti')} checked={include.notes} onChange={toggle('notes')} />
          <ScienceSwitch icon={Scale} label={tr('Peso corporeo')} description={tr('Tendenza e velocità di cambiamento')} checked={include.weight} onChange={toggle('weight')} />
          <ScienceSwitch icon={Apple} label={tr('Alimentazione')} description={tr('Medie giornaliere di calorie e macro dal Diario')} checked={include.nutrition} onChange={toggle('nutrition')} />
          <ScienceSwitch icon={Sparkles} label={tr('Istruzioni per l\'AI')} description={tr('Aggiunge in testa cosa analizzare, così basta incollare')} checked={prompt} onChange={setPrompt} />
        </div>
      </section>

      <section className="ej-card air-card">
        <h2 className="air-card-title"><MessageSquareText size={16} />{tr('Domanda per l\'AI')} <small>{tr('facoltativa')}</small></h2>
        <textarea className="air-question" rows={3} value={question} maxLength={600} placeholder={tr('Es. perché la panca è ferma da tre settimane?')} onChange={e => setQuestion(e.target.value)} />
      </section>

      <section className="ej-card air-card air-preview-card">
        <div className="air-stats">
          <div><strong>{report.workouts}</strong><span>{report.workouts === 1 ? tr('allenamento') : tr('allenamenti')}</span></div>
          <div><strong>{report.words.toLocaleString()}</strong><span>{tr('parole')}</span></div>
          <div><strong>~{tokens.toLocaleString()}</strong><span>{tr('token')}</span></div>
        </div>
        <h2 className="air-card-title">{tr('Anteprima')}</h2>
        <pre className={`air-preview${expanded ? ' is-expanded' : ''}`}>{nothing ? tr('Scegli almeno una sezione da includere.') : report.text}</pre>
        <button type="button" className="air-expand" onClick={() => setExpanded(v => !v)}>{expanded ? tr('Mostra meno') : tr('Mostra tutto')}</button>
      </section>

      <div className="air-actions">
        {message && <p role="status" className="air-message"><Check size={14} />{message}</p>}
        <button type="button" className="ej-btn ej-btn--primary" disabled={nothing} onClick={copy}><Copy size={17} />{tr('Copia negli appunti')}</button>
        <div className="air-actions-row">
          {canShare && <button type="button" className="ej-btn ej-btn--secondary" disabled={nothing} onClick={share}><Share2 size={16} />{tr('Condividi')}</button>}
          <button type="button" className="ej-btn ej-btn--secondary" disabled={nothing} onClick={download}><Download size={16} />{tr('Scarica .txt')}</button>
        </div>
      </div>
    </div>
  );
}
