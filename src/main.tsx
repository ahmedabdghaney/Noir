import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {App as CapacitorApp} from '@capacitor/app';
import App from './App.tsx';
import './index.css';

const isAndroidApp = Capacitor.getPlatform() === 'android';
const isTvPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('tv') === '1';

const enableTvSupport = () => {
  if (document.documentElement.classList.contains('noir-tv-capabilities')) return;
  document.documentElement.classList.remove('noir-mobile-app');
  document.documentElement.classList.add('noir-tv-capabilities', 'noir-tv-app');
  const updateTvLayout = () => {
    document.documentElement.classList.add('noir-tv-layout');
  };

  const tvFocusableSelector = [
    'button:not(:disabled)',
    'a[href]',
    'input:not(:disabled)',
    'select:not(:disabled)',
    'textarea:not(:disabled)',
    '[data-tv-focusable]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const isVisible = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  };

  const tvCandidates = () => {
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
    ).filter(isVisible);
    const scope: ParentNode = dialogs.at(-1) || document;
    return Array.from(scope.querySelectorAll<HTMLElement>(tvFocusableSelector)).filter(isVisible);
  };

  const focusInDirection = (direction: 'left' | 'right' | 'up' | 'down') => {
    const candidates = tvCandidates();
    if (!candidates.length) return;

    const current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    if (!current || !candidates.includes(current)) {
      candidates[0].focus({ preventScroll: true });
      candidates[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }

    const currentRect = current.getBoundingClientRect();
    const currentX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + currentRect.height / 2;

    const ranked = candidates
      .filter((candidate) => candidate !== current)
      .map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const dx = x - currentX;
        const dy = y - currentY;
        const primary =
          direction === 'left' ? -dx :
          direction === 'right' ? dx :
          direction === 'up' ? -dy : dy;
        if (primary <= 1) return null;
        const secondary = direction === 'left' || direction === 'right'
          ? Math.abs(dy)
          : Math.abs(dx);
        return { candidate, score: primary + secondary * 2.4 };
      })
      .filter((entry): entry is { candidate: HTMLElement; score: number } => Boolean(entry))
      .sort((a, b) => a.score - b.score);

    const next = ranked[0]?.candidate;
    if (!next) return;
    next.focus({ preventScroll: true });
    next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  window.addEventListener('resize', updateTvLayout);
  updateTvLayout();

  document.addEventListener('keydown', (event) => {
    if (!document.documentElement.classList.contains('noir-tv-layout')) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('input, textarea, select, [data-tv-player]')) return;

    const direction = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    }[event.key] as 'left' | 'right' | 'up' | 'down' | undefined;

    if (direction) {
      event.preventDefault();
      focusInDirection(direction);
      return;
    }

    if (event.key === 'Enter' && document.activeElement instanceof HTMLElement) {
      const active = document.activeElement;
      if (active.matches('[data-tv-focusable]') && active.tagName !== 'BUTTON' && active.tagName !== 'A') {
        event.preventDefault();
        active.click();
      }
    }
  });
};

let deviceModeReady: Promise<void> = Promise.resolve();

if (isAndroidApp) {
  document.documentElement.classList.add('noir-android-app');
  if (navigator.userAgent.includes('NoirTV')) {
    enableTvSupport();
  } else {
    deviceModeReady = CapacitorApp.getInfo()
      .then(({id}) => {
        if (id === 'com.aswadiq.noir') enableTvSupport();
        else document.documentElement.classList.add('noir-mobile-app');
      })
      .catch(() => {
        document.documentElement.classList.add('noir-mobile-app');
      });
  }
} else if (isTvPreview) {
  enableTvSupport();
}

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
    if (document.documentElement.classList.contains('noir-mobile-player-open')) {
      window.dispatchEvent(new Event('noir_mobile_player_back'));
      return;
    }
    const openDialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    if (openDialog) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
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

void deviceModeReady.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
