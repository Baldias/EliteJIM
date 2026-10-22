import React from 'react';
import './ProgressRing.css';

// Anello di avanzamento (0-1) usato nella striscia della settimana
export function ProgressRing({ progress = 0, size = 30, stroke = 3, color = 'var(--c-primary)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const len = Math.min(1, Math.max(0, progress)) * c;
  return (
    <span className="mn-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-2)" strokeWidth={stroke} />
        {len > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="mn-ring-center">{children}</span>
    </span>
  );
}
