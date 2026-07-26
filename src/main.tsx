import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {App as CapacitorApp} from '@capacitor/app';
import App from './App.tsx';
import './index.css';

// Safari على iOS قد يحتفظ بالتبويب القديم حياً حتى بعد نشر نسخة جديدة.
// نقارن ملف JavaScript المحمّل بآخر index.html عند فتح/استعادة التبويب،
// وإذا تغيّر نعمل reload واحد تلقائياً.
let lastUpdateCheck = 0;
let updateReloadStarted = false;

async function checkForAppUpdate() {
  if (Capacitor.isNativePlatform() || import.meta.env.DEV || updateReloadStarted) return;
  const now = Date.now();
  if (now - lastUpdateCheck < 15_000) return;
  lastUpdateCheck = now;

  try {
    const response = await fetch(`/?__noir_update=${now}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return;

    const latestHtml = await response.text();
    const latestDocument = new DOMParser().parseFromString(latestHtml, 'text/html');
    const latestEntry = latestDocument.querySelector<HTMLScriptElement>('script[type="module"][src]');
    const currentEntry = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
    const latestSrc = latestEntry?.getAttribute('src');
    const currentSrc = currentEntry?.getAttribute('src');
    if (!latestSrc || !currentSrc) return;

    const latestPath = new URL(latestSrc, window.location.origin).pathname;
    const currentPath = new URL(currentSrc, window.location.origin).pathname;
    if (latestPath !== currentPath) {
      updateReloadStarted = true;
      window.location.reload();
    }
  } catch {
    // انقطاع الشبكة ليس سبباً لتعطيل الموقع؛ نعيد الفحص عند الرجوع لاحقاً.
  }
}

window.addEventListener('pageshow', () => void checkForAppUpdate());
window.addEventListener('focus', () => void checkForAppUpdate());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkForAppUpdate();
});

if (Capacitor.isNativePlatform()) {
  void CapacitorApp.addListener('appUrlOpen', ({url}) => {
    try {
      const incomingUrl = new URL(url);
      if (incomingUrl.hash) {
        window.location.hash = incomingUrl.hash;
      }
    } catch {
      // Ignore malformed external links and keep the current screen open.
    }
  });

  void CapacitorApp.addListener('backButton', ({canGoBack}) => {
    const hash = window.location.hash;
    if (canGoBack || (hash && hash !== '#home')) {
      window.history.back();
      return;
    }
    void CapacitorApp.exitApp();
  });
}

// تسجيل وتحديث Service Worker مع تجاوز HTTP cache الخاص بـ Safari.
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let workerReloadStarted = false;

  if (hadController) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (workerReloadStarted) return;
      workerReloadStarted = true;
      window.location.reload();
    });
  }

  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
