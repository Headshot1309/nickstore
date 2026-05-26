const staleAssetPatterns = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk/i,
  /MIME type/i,
];

const clearBrowserAppCaches = async () => {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));
  }
};

const recoverOnce = async () => {
  if (sessionStorage.getItem('nickstore_recovered_stale_assets') === 'true') return;
  sessionStorage.setItem('nickstore_recovered_stale_assets', 'true');
  await clearBrowserAppCaches();
  window.location.reload();
};

export const installStaleAppRecovery = () => {
  window.addEventListener('error', (event) => {
    const message = `${event.message || ''} ${(event.error as Error | undefined)?.message || ''}`;
    if (staleAssetPatterns.some((pattern) => pattern.test(message))) {
      void recoverOnce();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = String(event.reason?.message || event.reason || '');
    if (staleAssetPatterns.some((pattern) => pattern.test(message))) {
      void recoverOnce();
    }
  });
};
