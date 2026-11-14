import '@fontsource/press-start-2p';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
    // On a first visit the page's files load before the worker is in control, so hand it
    // the list to cache. Without this the app only works offline from the second visit.
    void navigator.serviceWorker.ready.then((registration) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => url.startsWith(location.origin));
      registration.active?.postMessage({ type: 'precache', urls });
    });
  });
}

if (import.meta.env.DEV) {
  // Tuning aid: `await mathwaveDemo()` in the console downloads a WAV of the beat + sample answers.
  void import('./audio/offline').then((m) => Object.assign(window, { mathwaveDemo: m.downloadDemo, mathwaveOffline: m }));
}
