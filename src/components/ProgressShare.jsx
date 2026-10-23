import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Download, Image, LoaderCircle, Share2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Sheet } from '../pages/monitoring/Sheet';
import { ScienceSwitch } from './ScienceTraining';
import { buildProgressReport } from '../utils/progressReport';
import { renderProgressReport } from '../utils/progressReportRender';
import './ProgressShare.css';
import { IS_DEMO } from '../demo/demoMode';

const SNAPSHOT_FIELDS = ['history', 'userXP', 'scienceState', 'scienceReport', 'bodyweight', 'weightLog', 'customExercises', 'exerciseOverrides'];
function download(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function PreparedReport({ report, onClose, onRetry, includeWeight, onWeightChange, canIncludeWeight }) {
  const [artifacts, setArtifacts] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    renderProgressReport(report, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setArtifacts(result);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason.message || 'Impossibile preparare il report.');
    });
    return () => controller.abort();
  }, [report]);
  const share = async () => {
    if (!artifacts) return;
    setMessage('');
    const file = new File([artifacts.pdfBlob], artifacts.filename, { type: 'application/pdf' });
    if (typeof navigator.share !== 'function' || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
      download(artifacts.pdfBlob, artifacts.filename);
      setMessage('PDF scaricato: puoi inviarlo dall’app che preferisci.');
      return;
    }
    try { await navigator.share({ title: 'I miei progressi su EliteJIM', files: [file] }); }
    catch (reason) { if (reason.name !== 'AbortError') setMessage('Condivisione non disponibile qui. Puoi usare “Scarica PDF”.'); }
  };
  const footer = artifacts && <div className="progress-share-actions"><button type="button" className="ej-btn ej-btn--primary" onClick={share}><Share2 size={17} />Condividi report completo</button><div><button type="button" className="ej-btn ej-btn--secondary" onClick={() => download(artifacts.pdfBlob, artifacts.filename)}><Download size={15} />Scarica PDF</button><button type="button" className="ej-btn ej-btn--secondary" disabled={!artifacts.summaryPng} onClick={() => download(artifacts.summaryPng, artifacts.filename.replace('.pdf', '-riepilogo.png'))}><Image size={15} />Riepilogo PNG</button></div><p>Condividi tutte le pagine. Se il dispositivo non lo supporta, scarichiamo il PDF.</p>{message && <p role="status" className="progress-share-message">{message}</p>}</div>;
  return <Sheet title="Condividi i progressi" full onClose={onClose} footer={footer}>
    <p className="science-sheet-intro">I tuoi esercizi, divisi per gruppo muscolare, con grafici e record. Attività e Scienza completano il report. Nessun account richiesto a chi lo riceve.</p>
    {canIncludeWeight && <ScienceSwitch label="Includi anche il peso" description="Aggiunge il grafico delle pesate del Diario" checked={includeWeight} onChange={onWeightChange} />}
    {error ? <div className="progress-share-empty"><h3>Il report non è pronto</h3><p>{error}</p><button type="button" className="ej-btn ej-btn--primary" onClick={onRetry}>Riprova</button></div> : !artifacts ? <div className="progress-share-loading" role="status"><LoaderCircle size={30} /><strong>Preparo i tuoi progressi</strong><p>Grafici e tutti i {report.exercises.length} esercizi registrati.</p></div> : <>
      <div className="progress-share-pager"><button type="button" className="ej-icon-btn" disabled={page === 0} aria-label="Pagina precedente del report" onClick={() => setPage(n => n - 1)}><ArrowLeft size={18} /></button><span>Pagina {page + 1} di {artifacts.pages.length}<small>{artifacts.pages[page].title}</small></span><button type="button" className="ej-icon-btn" disabled={page === artifacts.pages.length - 1} aria-label="Pagina successiva del report" onClick={() => setPage(n => n + 1)}><ArrowRight size={18} /></button></div>
      <img className="progress-share-preview" src={artifacts.images[page]} alt={`${artifacts.pages[page].title} · pagina ${page + 1} del report dei progressi`} />
    </>}
  </Sheet>;
}

export default function ProgressShare() {
  const [capture, setCapture] = useState(null);
  const [includeWeight, setIncludeWeight] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const report = useMemo(() => capture ? buildProgressReport(capture.state, capture.at, { includeWeight, demo: IS_DEMO }) : null, [capture, includeWeight]);
  const open = () => {
    const state = useStore.getState();
    setCapture({ state: structuredClone(Object.fromEntries(SNAPSHOT_FIELDS.map(key => [key, state[key]]))), at: Date.now() });
    setIncludeWeight(false); setAttempt(0);
  };
  return <>
    <button type="button" className="ej-card progress-share-entry" onClick={open}><span><Share2 size={21} /></span><div><strong>Condividi i tuoi progressi</strong><small>Un report grafico completo, pronto da inviare</small></div><ChevronRight size={18} /></button>
    {report && <PreparedReport key={`${includeWeight}-${attempt}`} report={report} includeWeight={includeWeight} onWeightChange={setIncludeWeight} canIncludeWeight={capture.state.weightLog?.length > 0} onClose={() => setCapture(null)} onRetry={() => setAttempt(n => n + 1)} />}

  </>;
}
