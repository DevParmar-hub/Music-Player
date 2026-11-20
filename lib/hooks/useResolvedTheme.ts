import { useSyncExternalStore } from 'react';

type ResolvedTheme = 'dark' | 'light';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/**
 * The theme currently on screen. Reads <html data-theme>, which the
 * AppShell keeps up to date, so "system" is already resolved.
 */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'),
    () => 'dark',
  );
}
