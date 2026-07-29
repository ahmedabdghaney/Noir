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

  const tvFocusableSelectors = [
    'button:not(:disabled)',
    'a[href]',
    'input:not(:disabled)',
    'select:not(:disabled)',
    'textarea:not(:disabled)',
    '[data-tv-focusable]',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const tvFocusableSelector = tvFocusableSelectors.join(',');

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

  let verticalScrollFrame: number | undefined;
  let lastVerticalRepeatAt = 0;
  let lastHorizontalRepeatAt = 0;
  const scrollVerticallyTo = (element: HTMLElement, continuous = false) => {
    if (verticalScrollFrame !== undefined) {
      window.cancelAnimationFrame(verticalScrollFrame);
      verticalScrollFrame = undefined;
    }

    const rect = element.getBoundingClientRect();
    const navigationSafeArea = 112;
    const bottomSafeArea = 28;
    const availableHeight = Math.max(
      1,
      window.innerHeight - navigationSafeArea - bottomSafeArea,
    );
    const target = Math.max(
      0,
      window.scrollY +
        rect.top -
        navigationSafeArea -
        Math.max(0, (availableHeight - rect.height) / 2),
    );
    const start = window.scrollY;
    const distance = target - start;
    if (Math.abs(distance) < 2) return;

    /*
     * حركة قصيرة قابلة للإلغاء: كل ضغطة جديدة تبدأ من الموقع الحالي،
     * لذلك تبقى ناعمة من دون تراكم حركات بعد ترك أزرار الريموت.
     */
    const duration = continuous
      ? Math.min(280, Math.max(220, Math.abs(distance) * 0.2))
      : Math.min(420, Math.max(300, Math.abs(distance) * 0.36));
    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, start + distance * eased);
      if (progress < 1) {
        verticalScrollFrame = window.requestAnimationFrame(animate);
      } else {
        verticalScrollFrame = undefined;
      }
    };
    verticalScrollFrame = window.requestAnimationFrame(animate);
  };

  const tvCandidates = () => {
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
    ).filter(isVisible);
    const scope: ParentNode = dialogs.at(-1) || document;
    const scopedCandidates = Array.from(
      scope.querySelectorAll<HTMLElement>(tvFocusableSelector),
    ).filter(
      (element) => isVisible(element) && !element.closest('[data-tv-ignore-focus]'),
    );
    if (!(scope instanceof HTMLElement) || !scope.classList.contains('noir-tv-search-overlay')) {
      return scopedCandidates;
    }
    const navigationCandidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        tvFocusableSelectors
          .map((selector) => `[data-tv-navigation] ${selector}`)
          .join(','),
      ),
    ).filter(
      (element) => isVisible(element) && !element.closest('[data-tv-ignore-focus]'),
    );
    return [...scopedCandidates, ...navigationCandidates];
  };

  const scrollHorizontallyTo = (
    element: HTMLElement,
    continuous: boolean,
    inline: ScrollLogicalPosition,
  ) => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      // أثناء الـHold نحرّك أقل مسافة لازمة حتى تبقى السرعة مقروءة.
      inline: continuous ? 'nearest' : inline,
    });
  };

  const focusInDirection = (
    direction: 'left' | 'right' | 'up' | 'down',
    continuous = false,
  ) => {
    const allCandidates = tvCandidates();
    const current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const currentIsNavigation = Boolean(current?.closest('[data-tv-navigation]'));
    const candidates =
      !currentIsNavigation
        ? allCandidates.filter((candidate) => !candidate.closest('[data-tv-navigation]'))
        : allCandidates;
    if (!candidates.length) return;

    if (!current || !allCandidates.includes(current)) {
      const initial =
        allCandidates.find((candidate) => candidate.hasAttribute('data-tv-autofocus')) ||
        allCandidates.find((candidate) => candidate.hasAttribute('data-tv-hero')) ||
        candidates[0];
      initial.focus({ preventScroll: true });
      initial.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      return;
    }

    const currentRect = current.getBoundingClientRect();
    const currentX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + currentRect.height / 2;
    const focusTopNavigation = () => {
      const navigationTarget =
        allCandidates.find((candidate) =>
          candidate.closest('[data-tv-navigation]') &&
          candidate.getAttribute('aria-current') === 'page',
        ) ||
        allCandidates.find((candidate) =>
          candidate.closest('[data-tv-navigation]') &&
          candidate.getAttribute('data-tv-nav-item') === 'home',
        ) ||
        allCandidates.find((candidate) => candidate.closest('[data-tv-navigation]'));
      if (!navigationTarget) return false;
      navigationTarget.focus({ preventScroll: true });
      return true;
    };

    if (
      direction === 'up' &&
      !currentIsNavigation &&
      current.closest('[data-tv-top-actions]')
    ) {
      focusTopNavigation();
      return;
    }

    if (
      direction === 'up' &&
      !currentIsNavigation &&
      current.closest('[data-tv-episodes-row]')
    ) {
      const seasonButton = document.querySelector<HTMLElement>('[data-tv-season-button]');
      if (seasonButton && isVisible(seasonButton)) {
        seasonButton.focus({ preventScroll: true });
        scrollVerticallyTo(seasonButton, continuous);
      }
      return;
    }

    /*
     * عند الانتقال العمودي بين صفوف البطاقات نعتمد ترتيب الأقسام في الصفحة،
     * وليس التخمين الهندسي، حتى لا نتجاوز صفاً كاملاً أثناء حركة السكرول.
     */
    if (
      (direction === 'up' || direction === 'down') &&
      !currentIsNavigation &&
      current.matches('[data-tv-card]')
    ) {
      const currentRow = current.closest<HTMLElement>('[data-tv-focus-row]');
      if (currentRow) {
        const cardRows = Array.from(
          document.querySelectorAll<HTMLElement>('[data-tv-focus-row]'),
        ).filter(
          (row) =>
            isVisible(row) &&
            Boolean(row.querySelector('[data-tv-card]')),
        );
        const rowIndex = cardRows.indexOf(currentRow);
        const rowDelta = direction === 'down' ? 1 : -1;
        const nextRow = rowIndex >= 0 ? cardRows[rowIndex + rowDelta] : undefined;
        const nextCard = nextRow
          ? Array.from(nextRow.querySelectorAll<HTMLElement>(tvFocusableSelector))
              .find(
                (candidate) =>
                  candidate.matches('[data-tv-card]') &&
                  isVisible(candidate) &&
                  !candidate.closest('[data-tv-ignore-focus]'),
              )
          : undefined;
        if (nextCard) {
          nextCard.focus({ preventScroll: true });
          scrollVerticallyTo(nextCard, continuous);
          return;
        }
      }
    }

    /*
     * Horizontal TV rows keep their own navigation history. Geometry alone can
     * mistake the fixed sidebar for the next item after the row has scrolled,
     * because the previously visited cards are temporarily behind the sidebar.
     */
    if (!currentIsNavigation && (direction === 'left' || direction === 'right')) {
      const focusRow = current.closest<HTMLElement>('[data-tv-focus-row]');
      if (focusRow) {
        const rowCandidates = Array.from(
          focusRow.querySelectorAll<HTMLElement>(tvFocusableSelector),
        ).filter(
          (candidate) =>
            isVisible(candidate) &&
            !candidate.closest('[data-tv-ignore-focus]') &&
            !candidate.closest('[data-tv-navigation]'),
        );
        const currentIndex = rowCandidates.indexOf(current);
        const isRtl = window.getComputedStyle(focusRow).direction === 'rtl';
        const indexDelta =
          direction === 'left'
            ? (isRtl ? 1 : -1)
            : (isRtl ? -1 : 1);
        const nextInRow = currentIndex >= 0
          ? rowCandidates[currentIndex + indexDelta]
          : undefined;

        if (nextInRow) {
          nextInRow.focus({ preventScroll: true });
          scrollHorizontallyTo(nextInRow, continuous, 'center');
          return;
        }

        // At either edge keep focus in the row; the top navigation is reached with Up.
        return;
      }
    }

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
        if (
          (direction === 'left' || direction === 'right') &&
          Math.abs(dy) > Math.max(currentRect.height, rect.height) * 0.65
        ) {
          return null;
        }
        return { candidate, score: primary + secondary * 2.4 };
      })
      .filter((entry): entry is { candidate: HTMLElement; score: number } => Boolean(entry))
      .sort((a, b) => a.score - b.score);

    let next = ranked[0]?.candidate;
    if (next && direction === 'down') {
      const currentRow = current.closest<HTMLElement>('[data-tv-focus-row]');
      const nextRow = next.closest<HTMLElement>('[data-tv-focus-row]');
      if (nextRow && nextRow !== currentRow) {
        next =
          Array.from(nextRow.querySelectorAll<HTMLElement>(tvFocusableSelector))
            .find(
              (candidate) =>
                isVisible(candidate) &&
                !candidate.closest('[data-tv-ignore-focus]') &&
                !candidate.closest('[data-tv-navigation]'),
            ) || next;
      }
    }
    if (!next && direction === 'up' && !currentIsNavigation) {
      focusTopNavigation();
      return;
    }
    if (!next) return;
    next.focus({ preventScroll: true });
    if (next.closest('[data-tv-season-menu]')) {
      return;
    }
    if (direction === 'up' || direction === 'down') {
      scrollVerticallyTo(next, continuous);
    } else {
      scrollHorizontallyTo(next, continuous, 'nearest');
    }
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
      const now = performance.now();
      const vertical = direction === 'up' || direction === 'down';
      const continuous = event.repeat;
      if (continuous) {
        const lastRepeatAt = vertical ? lastVerticalRepeatAt : lastHorizontalRepeatAt;
        const repeatInterval = vertical ? 220 : 180;
        if (now - lastRepeatAt < repeatInterval) return;
        if (vertical) lastVerticalRepeatAt = now;
        else lastHorizontalRepeatAt = now;
      }
      focusInDirection(direction, continuous);
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
    if (document.documentElement.classList.contains('noir-native-player-open')) {
      window.dispatchEvent(new Event('noir_native_player_back'));
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
