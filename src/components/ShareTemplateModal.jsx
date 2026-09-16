import React, { useState } from 'react';
import { Share2, Copy, Download, Check, X, Dumbbell, MessageSquareShare } from 'lucide-react';
import { formatTemplatesForExport, downloadTemplatesAsJson } from '../utils/aiRoutineHelper';
import './ShareTemplateModal.css';

export function ShareTemplateModal({ isOpen, onClose, template, templates = [] }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const targetTemplates = template ? [template] : templates;
  const isMultiple = targetTemplates.length > 1;
  const routineTitle = isMultiple 
    ? `${targetTemplates.length} Schede Selezionate` 
    : (targetTemplates[0]?.name || 'Scheda Workout');

  const totalExercises = targetTemplates.reduce((acc, t) => acc + (t.exercises?.length || 0), 0);
  const jsonString = formatTemplatesForExport(targetTemplates);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      const el = document.createElement('textarea');
      el.value = jsonString;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `EliteJIM - ${routineTitle}`,
          text: jsonString
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyJson();
        }
      }
    } else {
      handleCopyJson();
    }
  };

  const handleDownload = () => {
    const filename = isMultiple ? 'schede-elitejim' : (targetTemplates[0]?.name || 'scheda-elitejim');
    downloadTemplatesAsJson(targetTemplates, filename);
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-container" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-modal-title-group">
            <Share2 size={18} className="share-modal-icon" />
            <div>
              <h3 className="share-modal-title">Esporta & Condividi</h3>
              <p className="share-modal-subtitle">Invia la tua scheda ai tuoi compagni di allenamento</p>
            </div>
          </div>
          <button className="share-modal-close-btn" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="share-modal-body">
          
          {/* Card riassuntiva della scheda */}
          <div className="share-routine-summary-card">
            <div className="share-routine-title-row">
              <Dumbbell size={16} color="#00e5ff" />
              <span className="share-routine-name">{routineTitle}</span>
              <span className="share-routine-count">{totalExercises} esercizi</span>
            </div>

            {!isMultiple && targetTemplates[0]?.exercises && (
              <div className="share-routine-chips">
                {targetTemplates[0].exercises.map((ex, i) => (
                  <span key={i} className="share-mini-chip">
                    {ex.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Azioni di condivisione */}
          <div className="share-actions-group">
            {typeof navigator !== 'undefined' && !!navigator.share && (
              <button
                type="button"
                className="share-btn-primary"
                onClick={handleNativeShare}
              >
                <Share2 size={16} />
                <span>Condividi su WhatsApp / Altro</span>
              </button>
            )}

            <button
              type="button"
              className={`share-btn-copy ${copied ? 'copied' : ''}`}
              onClick={handleCopyJson}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'JSON Copiato negli Appunti!' : 'Copia Codice Scheda (JSON)'}</span>
            </button>

            <button
              type="button"
              className="share-btn-download"
              onClick={handleDownload}
            >
              <Download size={16} />
              <span>Scarica file .json</span>
            </button>
          </div>

          {/* Istruzioni per l'amico */}
          <div className="share-guide-box">
            <p className="share-guide-title">Come fa il tuo amico ad importarla?</p>
            <p className="share-guide-text">
              Gli basterà copiare il codice, aprire <strong>EliteJIM</strong>, andare su <strong>Impostazioni → Crea Scheda con AI & JSON → Importa JSON</strong> e incollare il testo. La scheda sarà subito pronta per allenarsi!
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
