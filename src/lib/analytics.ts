// Custom events for Google Analytics. Base.astro defines gtag only on the live site, so this is a no-op
// in dev, in forks and inside embeds.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: Record<string, string | number | boolean> = {}): void {
  window.gtag?.('event', event, params);
}
