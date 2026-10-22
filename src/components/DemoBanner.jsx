import React from 'react';
import { FlaskConical, X } from 'lucide-react';
import { IS_DEMO, exitDemo } from '../demo/demoMode';
import './DemoBanner.css';

function DemoBanner() {
  if (!IS_DEMO) return null;

  return (
    <div className="demo-banner" role="status">
      <FlaskConical size={14} />
      <span>Modalità demo · dati di esempio</span>
      <button type="button" className="demo-banner-exit" onClick={exitDemo} aria-label="Esci dalla demo">
        <X size={14} />
      </button>
    </div>
  );
}

export default DemoBanner;
