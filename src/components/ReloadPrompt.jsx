import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
      // Controlla la presenza di aggiornamenti ogni ora
      r && setInterval(() => {
        r.update();
      }, 60 * 60 * 100);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-toast">
      <div className="pwa-message">
        <span>C'è un nuovo aggiornamento dell'app!</span>
      </div>
      <div className="pwa-buttons">
        <button className="pwa-btn pwa-btn-reload" onClick={() => updateServiceWorker(true)}>
          Aggiorna ora
        </button>
        <button className="pwa-btn pwa-btn-close" onClick={() => setNeedRefresh(false)}>
          Più tardi
        </button>
      </div>
    </div>
  );
}

export default ReloadPrompt;
