import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Sheet } from './Sheet';

const FORMATS = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128];

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const [error, setError] = useState(cameraSupported ? '' : 'La fotocamera non è disponibile su questo dispositivo o browser. Inserisci il codice a mano.');
  const [manual, setManual] = useState('');

  useEffect(() => {
    let controls = null;
    let stopped = false;
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, FORMATS]]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

    if (!cameraSupported) return undefined;

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result, _err, ctl) => {
        if (result && !stopped) {
          stopped = true;
          ctl.stop();
          navigator.vibrate?.(60);
          onDetected(result.getText());
        }
      })
      .then((ctl) => {
        controls = ctl;
        if (stopped) ctl.stop();
      })
      .catch((err) => {
        setError(err?.name === 'NotAllowedError'
          ? 'Permesso fotocamera negato. Abilitalo dalle impostazioni del browser oppure inserisci il codice a mano.'
          : 'Impossibile avviare la fotocamera. Inserisci il codice a mano.');
      });

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onDetected, cameraSupported]);

  const submitManual = (e) => {
    e.preventDefault();
    const code = manual.replace(/\D/g, '');
    if (code.length >= 6) onDetected(code);
  };

  return (
    <Sheet title="Scansiona codice a barre" onClose={onClose} full>
      <div className="mn-scanner">
        {error ? (
          <p className="mn-scanner-error">{error}</p>
        ) : (
          <div className="mn-scanner-view">
            <video ref={videoRef} muted playsInline />
            <span className="mn-scanner-frame" aria-hidden="true" />
            <p>Inquadra il codice a barre della confezione</p>
          </div>
        )}
        <form className="mn-scanner-manual" onSubmit={submitManual}>
          <input
            className="mn-input"
            inputMode="numeric"
            placeholder="Oppure digita il codice (es. 8076800195057)"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button type="submit" className="ej-btn ej-btn--primary" disabled={manual.replace(/\D/g, '').length < 6}>Cerca</button>
        </form>
      </div>
    </Sheet>
  );
}
