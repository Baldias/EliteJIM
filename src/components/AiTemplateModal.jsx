import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { getAllExercises } from '../data/exercises';
import { 
  buildAiWorkoutPrompt, 
  parseAndValidateWorkoutJson,
  formatTemplatesForExport,
  downloadTemplatesAsJson
} from '../utils/aiRoutineHelper';
import { 
  Sparkles, Copy, Check, X, Code2, AlertTriangle, Dumbbell, 
  ClipboardPaste, ArrowRight, ChevronDown, ChevronUp, Share2, Download 
} from 'lucide-react';
import './AiTemplateModal.css';

export function AiTemplateModal({ isOpen, onClose, initialTab = 'prompt' }) {
  const customExercises = useStore(state => state.customExercises || []);
  const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
  const importTemplates = useStore(state => state.importTemplates);
  const templates = useStore(state => state.templates || []);

  const allExercises = useMemo(() => {
    return getAllExercises(customExercises, exerciseOverrides);
  }, [customExercises, exerciseOverrides]);

  const [activeTab, setActiveTab] = useState(initialTab); // 'prompt' | 'import' | 'export'

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Form state per prompt
  const [splitDays, setSplitDays] = useState(3);
  const [customGoal, setCustomGoal] = useState('Ipertrofia');
  const [userNotes, setUserNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRawPrompt, setShowRawPrompt] = useState(false);

  // Form state per import JSON
  const [jsonInput, setJsonInput] = useState('');
  const [importStatus, setImportStatus] = useState(null);

  // Form state per export
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [exportCopied, setExportCopied] = useState(false);

  // Inizializza i template selezionati con tutti i template disponibili
  useEffect(() => {
    if (templates.length > 0) {
      setSelectedTemplateIds(templates.map(t => t.id));
    }
  }, [templates]);

  // Genera il prompt in tempo reale
  const generatedPrompt = useMemo(() => {
    return buildAiWorkoutPrompt({
      allExercises,
      splitDays,
      customGoal,
      userNotes: userNotes.trim()
    });
  }, [allExercises, splitDays, customGoal, userNotes]);

  // Validazione in tempo reale del JSON
  const validationResult = useMemo(() => {
    if (!jsonInput.trim()) return null;
    return parseAndValidateWorkoutJson(jsonInput, allExercises);
  }, [jsonInput, allExercises]);

  // Template filtrati per l'esportazione
  const exportTemplatesList = useMemo(() => {
    return templates.filter(t => selectedTemplateIds.includes(t.id));
  }, [templates, selectedTemplateIds]);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      const el = document.createElement('textarea');
      el.value = generatedPrompt;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonInput(text);
      }
    } catch (err) {
      alert("Incolla manualmente premendo a lungo nell'area di testo.");
    }
  };

  const handleConfirmImport = () => {
    if (!validationResult || !validationResult.success) return;

    const count = importTemplates(validationResult.templates);
    setImportStatus({
      success: true,
      count,
      message: count === 1 ? '1 scheda importata con successo!' : `${count} schede importate!`
    });

    setTimeout(() => {
      setImportStatus(null);
      setJsonInput('');
      onClose();
    }, 1400);
  };

  // Funzioni di esportazione
  const handleToggleTemplateSelect = (id) => {
    setSelectedTemplateIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllTemplates = () => {
    if (selectedTemplateIds.length === templates.length) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(templates.map(t => t.id));
    }
  };

  const handleCopyExportJson = async () => {
    if (exportTemplatesList.length === 0) return;
    const jsonStr = formatTemplatesForExport(exportTemplatesList);
    try {
      await navigator.clipboard.writeText(jsonStr);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2500);
    } catch (err) {
      const el = document.createElement('textarea');
      el.value = jsonStr;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2500);
    }
  };

  const handleNativeShareExport = async () => {
    if (exportTemplatesList.length === 0) return;
    const jsonStr = formatTemplatesForExport(exportTemplatesList);
    const title = exportTemplatesList.length === 1 
      ? `EliteJIM: ${exportTemplatesList[0].name}`
      : `EliteJIM: ${exportTemplatesList.length} Schede`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text: jsonStr });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyExportJson();
        }
      }
    } else {
      handleCopyExportJson();
    }
  };

  const handleDownloadExportJson = () => {
    if (exportTemplatesList.length === 0) return;
    const filename = exportTemplatesList.length === 1 
      ? exportTemplatesList[0].name 
      : 'schede-elitejim';
    downloadTemplatesAsJson(exportTemplatesList, filename);
  };

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal-container" onClick={e => e.stopPropagation()}>
        
        {/* Header minimal */}
        <div className="ai-modal-header">
          <div className="ai-modal-title-group">
            <Sparkles size={18} className="ai-modal-sparkle-icon" />
            <div>
              <h2 className="ai-modal-title">Schede AI & Condivisione</h2>
              <p className="ai-modal-subtitle">Genera con AI, importa o invia schede agli amici</p>
            </div>
          </div>
          <button className="ai-modal-close-btn" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        {/* Segmented Control 3 Tabs */}
        <div className="ai-segmented-tabs-wrapper">
          <div className="ai-segmented-tabs">
            <button
              type="button"
              className={`ai-segment-btn ${activeTab === 'prompt' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompt')}
            >
              <Sparkles size={13} />
              <span>Prompt AI</span>
            </button>
            <button
              type="button"
              className={`ai-segment-btn ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              <Code2 size={13} />
              <span>Importa</span>
              {validationResult?.success && (
                <span className="ai-segment-badge">{validationResult.templates.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`ai-segment-btn ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              <Share2 size={13} />
              <span>Esporta</span>
              {templates.length > 0 && (
                <span className="ai-segment-count">({templates.length})</span>
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="ai-modal-body">
          {activeTab === 'prompt' ? (
            <div className="ai-tab-pane">
              
              {/* Opzioni minimali */}
              <div className="ai-options-grid">
                
                {/* Frequenza */}
                <div className="ai-option-item">
                  <span className="ai-option-label">Frequenza settimanale</span>
                  <div className="ai-capsule-row">
                    {[2, 3, 4, 5, 6].map(days => (
                      <button
                        key={days}
                        type="button"
                        className={`ai-capsule-btn ${splitDays === days ? 'active' : ''}`}
                        onClick={() => setSplitDays(days)}
                      >
                        {days} gg
                      </button>
                    ))}
                  </div>
                </div>

                {/* Obiettivo */}
                <div className="ai-option-item">
                  <span className="ai-option-label">Obiettivo principale</span>
                  <div className="ai-capsule-row">
                    {['Ipertrofia', 'Forza', 'Definizione', 'Full Body'].map(goal => (
                      <button
                        key={goal}
                        type="button"
                        className={`ai-capsule-btn ${customGoal === goal ? 'active' : ''}`}
                        onClick={() => setCustomGoal(goal)}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note opzionali */}
                <div className="ai-option-item">
                  <span className="ai-option-label">Note & personalizzazioni (opzionale)</span>
                  <input
                    type="text"
                    className="ai-minimal-input"
                    placeholder="Es. Focus spalle, no stacco per schiena..."
                    value={userNotes}
                    onChange={e => setUserNotes(e.target.value)}
                  />
                </div>

              </div>

              {/* Prompt Ready Card */}
              <div className="ai-prompt-card">
                <div className="ai-prompt-card-header">
                  <div className="ai-prompt-card-info">
                    <span className="ai-card-title">Prompt Master pronto</span>
                    <span className="ai-card-meta">• {allExercises.length} esercizi DB inclusi</span>
                  </div>
                  <button
                    type="button"
                    className="ai-toggle-preview-btn"
                    onClick={() => setShowRawPrompt(!showRawPrompt)}
                  >
                    <span>{showRawPrompt ? 'Nascondi' : 'Vedi testo'}</span>
                    {showRawPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {showRawPrompt && (
                  <div className="ai-raw-preview-wrapper">
                    <pre className="ai-raw-prompt-box">
                      {generatedPrompt}
                    </pre>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="ai-footer-actions">
                <button
                  type="button"
                  className={`ai-cta-primary ${copied ? 'copied' : ''}`}
                  onClick={handleCopyPrompt}
                >
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  <span>{copied ? 'Prompt Copiato negli Appunti!' : 'Copia Prompt per ChatGPT / Claude'}</span>
                </button>

                <button
                  type="button"
                  className="ai-subtle-nav-btn"
                  onClick={() => setActiveTab('import')}
                >
                  <span>Hai già la risposta dell'AI? Incolla il JSON</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Mini Guida in basso */}
              <div className="ai-friend-guide-box">
                <p className="ai-friend-guide-title">Come funziona?</p>
                <p className="ai-friend-guide-text">
                  1. Clicca <strong>Copia Prompt</strong> qui sopra.<br />
                  2. Incollalo su <strong>ChatGPT, Claude o Gemini</strong>.<br />
                  3. Copia il JSON restituito dall'AI e incollalo nella scheda <strong>Importa</strong>.
                </p>
              </div>

            </div>
          ) : activeTab === 'import' ? (
            <div className="ai-tab-pane">
              
              {/* Textarea Section */}
              <div className="ai-import-pane">
                <div className="ai-import-pane-header">
                  <span className="ai-option-label">Risposta JSON dall'AI</span>
                  <button
                    type="button"
                    className="ai-btn-paste-quick"
                    onClick={handlePasteFromClipboard}
                  >
                    <ClipboardPaste size={13} />
                    <span>Incolla</span>
                  </button>
                </div>

                <textarea
                  className="ai-minimal-textarea"
                  placeholder='Incolla qui il JSON generato da ChatGPT o inviato da un amico (es. [ { "name": "Push A", "exercises": [...] } ])'
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  rows={7}
                  spellCheck={false}
                />
              </div>

              {/* Validation Result */}
              {validationResult && (
                <div className="ai-validation-feedback">
                  {validationResult.success ? (
                    <div className="ai-success-panel">
                      <div className="ai-success-headline">
                        <Check size={16} className="ai-check-icon" />
                        <span>
                          <strong>{validationResult.stats.templatesCount} {validationResult.stats.templatesCount === 1 ? 'scheda pronta' : 'schede pronte'}</strong> ({validationResult.stats.totalExercises} esercizi)
                        </span>
                      </div>

                      {validationResult.stats.unknownCount > 0 && (
                        <div className="ai-warning-pill">
                          <AlertTriangle size={13} />
                          <span>
                            {validationResult.stats.unknownCount} es. non in lista verranno importati come personalizzati.
                          </span>
                        </div>
                      )}

                      {/* Lista preview schede */}
                      <div className="ai-validated-cards-list">
                        {validationResult.templates.map((tpl, i) => (
                          <div key={i} className="ai-validated-card">
                            <div className="ai-validated-card-header">
                              <div className="ai-validated-name">
                                <Dumbbell size={14} color="#00e5ff" />
                                <span>{tpl.name}</span>
                              </div>
                              <span className="ai-validated-badge">{tpl.exercises.length} es.</span>
                            </div>
                            <div className="ai-validated-chips">
                              {tpl.exercises.map((ex, exIdx) => (
                                <span key={exIdx} className="ai-mini-chip">
                                  {ex.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="ai-error-panel">
                      <AlertTriangle size={15} className="ai-err-icon" />
                      <span>{validationResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Import Status Toast */}
              {importStatus?.success && (
                <div className="ai-toast-success">
                  <Check size={18} />
                  <span>{importStatus.message}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="ai-footer-actions">
                <button
                  type="button"
                  className="ai-cta-primary"
                  disabled={!validationResult || !validationResult.success}
                  onClick={handleConfirmImport}
                >
                  <Check size={17} />
                  <span>
                    {validationResult?.success
                      ? `Salva ${validationResult.templates.length} ${validationResult.templates.length === 1 ? 'Scheda' : 'Schede'} in EliteJIM`
                      : 'Incolla un JSON valido per continuare'}
                  </span>
                </button>
              </div>

              {/* Mini Guida in basso */}
              <div className="ai-friend-guide-box">
                <p className="ai-friend-guide-title">Come funziona l'importazione?</p>
                <p className="ai-friend-guide-text">
                  Incolla il codice generato dall'AI o inviato da un amico. Verrà convalidato all'istante verificando tutti gli esercizi del database di EliteJIM e salvato tra le tue schede in 1 click.
                </p>
              </div>

            </div>
          ) : (
            /* TAB 3: ESPORTA SCHEDE */
            <div className="ai-tab-pane">
              {templates.length === 0 ? (
                <div className="ai-empty-export-state">
                  <Dumbbell size={28} color="rgba(255,255,255,0.2)" />
                  <p className="ai-empty-export-title">Nessuna scheda salvata</p>
                  <p className="ai-empty-export-text">
                    Crea una scheda dalla schermata Home o genera un prompt con l'AI per poterla esportare e inviare ai tuoi amici.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selettore schede */}
                  <div className="ai-export-header-row">
                    <span className="ai-option-label">
                      Seleziona ({selectedTemplateIds.length}/{templates.length})
                    </span>
                    <button
                      type="button"
                      className="ai-btn-text-action"
                      onClick={handleSelectAllTemplates}
                    >
                      {selectedTemplateIds.length === templates.length ? 'Deseleziona tutte' : 'Seleziona tutte'}
                    </button>
                  </div>

                  {/* Lista schede con selezione checkbox */}
                  <div className="ai-export-list">
                    {templates.map(tpl => {
                      const isSelected = selectedTemplateIds.includes(tpl.id);
                      return (
                        <div
                          key={tpl.id}
                          className={`ai-export-item-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleTemplateSelect(tpl.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Gestito da onClick genitore
                            className="ai-export-checkbox"
                          />
                          <div className="ai-export-item-info">
                            <span className="ai-export-item-name">{tpl.name}</span>
                            <span className="ai-export-item-meta">
                              {tpl.exercises?.length || 0} esercizi · {tpl.exercises?.reduce((a, e) => a + (Number(e.setsCount) || 0), 0)} serie
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Azioni di esportazione */}
                  <div className="ai-export-actions">
                    {typeof navigator !== 'undefined' && !!navigator.share && (
                      <button
                        type="button"
                        className="ai-cta-primary"
                        disabled={exportTemplatesList.length === 0}
                        onClick={handleNativeShareExport}
                      >
                        <Share2 size={16} />
                        <span>Condividi su WhatsApp / Telegram</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className={`ai-btn-secondary ${exportCopied ? 'copied' : ''}`}
                      disabled={exportTemplatesList.length === 0}
                      onClick={handleCopyExportJson}
                    >
                      {exportCopied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{exportCopied ? 'Codice Copiato!' : 'Copia Codice Schede (JSON)'}</span>
                    </button>

                    <button
                      type="button"
                      className="ai-subtle-nav-btn"
                      disabled={exportTemplatesList.length === 0}
                      onClick={handleDownloadExportJson}
                      style={{ marginTop: '2px' }}
                    >
                      <Download size={14} />
                      <span>Scarica file .json</span>
                    </button>
                  </div>

                  {/* Guida amico */}
                  <div className="ai-friend-guide-box">
                    <p className="ai-friend-guide-title">Come fa il tuo amico ad usarla?</p>
                    <p className="ai-friend-guide-text">
                      Invia il codice JSON. L'amico apre EliteJIM → <strong>Impostazioni → Schede AI & Condivisione → Importa</strong> e incolla il testo. La scheda verrà caricata subito sul suo account!
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
