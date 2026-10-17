export function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}

// One shared AudioContext: browsers cap how many can exist, so creating one per
// rest timer made the beep stop working after a few sets.
let audioCtx = null;

function getAudioContext() {
  if (audioCtx) return audioCtx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioCtx = new AudioContextClass();
  return audioCtx;
}

// Autoplay policies only let audio start from a user gesture: unlock (or resume,
// e.g. after the app was in background) the shared context on every tap.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }, { passive: true });
}

export function playBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // A web audio beep generally CANNOT bypass the iOS physical mute switch.
    // This is an intentional OS-level restriction for web pages.
    
    // Play a sequence of 3 beeps
    const playSingleBeep = (timeOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime + timeOffset); // A5 note
      gain.gain.setValueAtTime(0, ctx.currentTime + timeOffset); 
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + timeOffset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + timeOffset + 0.4); 
      
      osc.start(ctx.currentTime + timeOffset);
      osc.stop(ctx.currentTime + timeOffset + 0.4);
    };

    playSingleBeep(0);     // First beep
    playSingleBeep(0.5);   // Second beep
    playSingleBeep(1.0);   // Third beep

  } catch(e) {
    console.warn("Audio playback failed", e);
  }
}

export function notifyTimerComplete() {
  playBeep();
  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Create a non-persistent notification that shows a popup
      new Notification("Recupero Terminato!", {
        body: "Prendi fiato... e spingi il prossimo set!",
        icon: "/vite.svg",
        vibrate: [200, 100, 200]
      });
    } catch {
      // Fallback for some mobile browsers that require service worker for notifications
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification("Recupero Terminato!", {
          body: "Prendi fiato... e spingi il prossimo set!",
          icon: "/vite.svg",
          vibrate: [200, 100, 200]
        });
      }).catch(err => console.warn(err));
    }
  }
}
