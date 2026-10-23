import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Pannelli aperti: lo scroll del body si sblocca solo quando si chiude l'ultimo,
// anche se pannelli annidati vengono smontati insieme in ordine qualsiasi.
let openSheets = 0;

// Pannello a scomparsa dal basso usato da tutta la sezione Diario
// (montato nel body per non dipendere dallo stacking della pagina).
// `overlay` resta fisso sopra il footer, fuori dall'area che scorre.
export function Sheet({ title, onClose, children, footer, full = false, headerExtra, overlay, className = '' }) {
  useEffect(() => {
    openSheets += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openSheets -= 1;
      if (openSheets === 0) document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={`mn-sheet-backdrop ${className}`} onClick={onClose}>
      <div
        className={`mn-sheet ${full ? 'is-full' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mn-sheet-head">
          <h2>{title}</h2>
          {headerExtra}
          <button type="button" className="ej-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </header>
        <div className="mn-sheet-body">{children}</div>
        {overlay && <div className="mn-sheet-overlay">{overlay}</div>}
        {footer && <footer className="mn-sheet-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
