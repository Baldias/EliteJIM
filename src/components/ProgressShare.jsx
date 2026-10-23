import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Check, Dna, Download, LoaderCircle, Share2, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Sheet } from '../pages/monitoring/Sheet';
import { ScienceSwitch } from './ScienceTraining';
import { buildProgressReport } from '../utils/progressReport';
import { renderProgressReport } from '../utils/progressReportRender';
import { canShareProgressPdf, createProgressDownloads, progressPdfFile, shareProgressPdf } from '../utils/progressReportExport';
import './ProgressShare.css';
import { IS_DEMO } from '../demo/demoMode';

const SNAPSHOT_FIELDS = ['history', 'userXP', 'scienceState', 'scienceReport', 'bodyweight', 'weightLog', 'customExercises', 'exerciseOverrides', 'theme', 'scienceGlow'];

function PreparedReport({ report, onClose, onRetry, onEdit }) {
  const [artifacts, setArtifacts] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let downloads;
    renderProgressReport(report, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      downloads = createProgressDownloads(result, navigator.userAgent);
      const file = progressPdfFile(result);
      setArtifacts({ ...result, downloads, file, nativeShare:canShareProgressPdf(file) });
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason.message || 'Impossibile preparare il report.');
    });
    return () => { controller.abort(); downloads?.dispose(); };
  }, [report]);
  const downloadMessage = () => setMessage(`Download del PDF completo richiesto: ${artifacts.pages.length} pagine in un solo file. Aprilo dai Download e usa Condividi per inviarlo.`);
  const share = async () => {
    if (!artifacts || sharing) return;
    setSharing(true); setMessage('');
    try {
      const result = await shareProgressPdf(artifacts.file, () => {
        const anchor = document.createElement('a');
        anchor.href = artifacts.downloads.pdfUrl; anchor.download = artifacts.filename;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
      });
      if (result === 'download') downloadMessage();
    } catch {
      setMessage('Usa “Salva PDF completo” qui sotto per scaricare tutte le pagine e condividerle dai Download.');
    } finally { setSharing(false); }
  };
  const footer = artifacts && <div className="progress-share-actions">
    <span className="progress-share-format">REPORT COMPLETO · {artifacts.pages.length} {artifacts.pages.length === 1 ? 'PAGINA' : 'PAGINE'}</span>
    {artifacts.nativeShare ? <><button type="button" className="ej-btn ej-btn--primary" disabled={sharing} onClick={share}><Share2 size={17} />{sharing ? 'Apro la condivisione…' : 'Condividi PDF completo'}</button><a className="ej-btn ej-btn--secondary" href={artifacts.downloads.pdfUrl} download={artifacts.filename} onClick={downloadMessage}><Download size={15} />Salva PDF completo</a></> : <a className="ej-btn ej-btn--primary" href={artifacts.downloads.pdfUrl} download={artifacts.filename} onClick={downloadMessage}><Download size={17} />Salva PDF completo</a>}
    <p>{artifacts.nativeShare ? 'Il PDF contiene tutte le pagine, anche quelle che non stai visualizzando.' : 'Per inviarlo: salva il PDF, aprilo nei Download del telefono e scegli Condividi.'}</p>
    {artifacts.downloads.pngUrl && <a className="progress-share-cover" href={artifacts.downloads.pngUrl} download={artifacts.filename.replace('.pdf','-copertina.png')}>Salva solo la copertina (PNG · 1 pagina)</a>}
    {message && <p role="status" className="progress-share-message">{message}</p>}
  </div>;
  return <Sheet title="Condividi i progressi" full onClose={onClose} footer={footer}>
    <p className="science-sheet-intro">I tuoi esercizi, divisi per gruppo muscolare, con grafici e record. {report.science ? 'Include tutte le settimane del protocollo Scienza corrente, con le stime indicate.' : 'Condividi le tue progressioni senza i dati di Scienza.'} Nessun account richiesto a chi lo riceve.</p>
    <button type="button" className="progress-share-edit" onClick={onEdit}>Modifica contenuto del report</button>
    {error ? <div className="progress-share-empty"><h3>Il report non è pronto</h3><p>{error}</p><button type="button" className="ej-btn ej-btn--primary" onClick={onRetry}>Riprova</button></div> : !artifacts ? <div className="progress-share-loading" role="status"><LoaderCircle size={30} /><strong>Preparo i tuoi progressi</strong><p>Grafici e tutti i {report.exercises.length} esercizi registrati.</p></div> : <>
      <div className="progress-share-pager"><button type="button" className="ej-icon-btn" disabled={page === 0} aria-label="Pagina precedente del report" onClick={() => setPage(n => n - 1)}><ArrowLeft size={18} /></button><span>Pagina {page + 1} di {artifacts.pages.length}<small>{artifacts.pages[page].title}</small></span><button type="button" className="ej-icon-btn" disabled={page === artifacts.pages.length - 1} aria-label="Pagina successiva del report" onClick={() => setPage(n => n + 1)}><ArrowRight size={18} /></button></div>
      <img className="progress-share-preview" src={artifacts.images[page]} alt={`${artifacts.pages[page].title} · pagina ${page + 1} del report dei progressi`} />
    </>}
  </Sheet>;
}

export default function ProgressShare() {
  const [capture, setCapture] = useState(null);
  const [includeWeight, setIncludeWeight] = useState(false);
  const [includeScience, setIncludeScience] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const report = useMemo(() => capture ? buildProgressReport(capture.state, capture.at, { includeWeight, includeScience, demo: IS_DEMO }) : null, [capture, includeWeight, includeScience]);
  const open = () => {
    const state = useStore.getState();
    setCapture({ state: structuredClone(Object.fromEntries(SNAPSHOT_FIELDS.map(key => [key, state[key]]))), at: Date.now() });
    setIncludeWeight(false); setIncludeScience(false); setPrepared(false); setAttempt(0);
  };
  return <>
    <button type="button" className="ej-card progress-share-entry" onClick={open}><span><Share2 size={21} /></span><div><strong>Condividi i tuoi progressi</strong><small>Un report grafico completo, pronto da inviare</small></div><ChevronRight size={18} /></button>
    {capture && !prepared && <Sheet title="Cosa vuoi condividere?" onClose={() => setCapture(null)} footer={<button type="button" className="ej-btn ej-btn--primary progress-share-prepare" onClick={() => setPrepared(true)}>Prepara il report<ArrowRight size={17} /></button>}>
      <p className="science-sheet-intro">Il report segue il tuo tema {capture.state.theme === 'og' ? 'OG Elite Jim' : 'Science V3 Edition'}. Scegli tu cosa includere.</p>
      <div className="progress-share-choices" role="radiogroup" aria-label="Contenuto del report">
        <button type="button" role="radio" aria-checked={!includeScience} onClick={() => setIncludeScience(false)}><TrendingUp size={24} /><span><strong>Solo progressioni</strong><small>Esercizi per muscolo, record e continuità.</small></span><i>{!includeScience && <Check size={15} />}</i></button>
        <button type="button" role="radio" aria-checked={includeScience} disabled={!capture.state.scienceState?.program && !capture.state.scienceReport?.baseLandmarks} onClick={() => setIncludeScience(true)}><Dna size={24} /><span><strong>Progressioni + Scienza</strong><small>Tutte le settimane del protocollo corrente. Le settimane future sono stime.</small></span><i>{includeScience && <Check size={15} />}</i></button>
      </div>
      {!capture.state.scienceState?.program && !capture.state.scienceReport?.baseLandmarks && <p className="science-sheet-intro">Non hai ancora un protocollo Scienza da includere.</p>}
      {capture.state.weightLog?.length > 0 && <ScienceSwitch label="Includi anche il peso" description="Aggiunge le pesate registrate nel Diario" checked={includeWeight} onChange={setIncludeWeight} />}
    </Sheet>}
    {prepared && report && <PreparedReport key={`${includeWeight}-${includeScience}-${attempt}`} report={report} onEdit={() => setPrepared(false)} onClose={() => setCapture(null)} onRetry={() => setAttempt(n => n + 1)} />}

  </>;
}
