import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// تسجيل Service Worker — ضروري لتفعيل PWA mode على iOS
// (يتيح requestFullscreen الحقيقي على أي عنصر لما يكون الموقع مثبّت بـ Add to Home Screen)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
