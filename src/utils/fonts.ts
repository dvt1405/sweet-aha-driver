// Utilities to consume the app-wide font family from CSS in both DOM and Phaser

const DEFAULT_STACK = '"Baloo Chettan 2", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';

let cachedFamily: string | null = null;

/**
 * Returns the resolved global app font-family string from CSS variable `--app-font-family`.
 * Falls back to a sane default stack when not available (SSR or missing variable).
 */
export function getAppFontFamily(): string {
  if (cachedFamily) return cachedFamily;
  if (typeof document === 'undefined') return DEFAULT_STACK;
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-font-family')
      .trim();
      console.log('getAppFontFamily', v);

    cachedFamily = v || DEFAULT_STACK;
    console.log('getAppFontFamily', cachedFamily);
    return cachedFamily;
  } catch {
    return DEFAULT_STACK;
  }
}

/** Get the first font family name from the resolved family (without quotes). */
export function getAppPrimaryFont(): string {
  const fam = getAppFontFamily();
  let first = (fam.split(',')[0] || '').trim();

  // If the first token is a CSS var like var(--font-main), try to resolve it
  if (typeof document !== 'undefined' && first.startsWith('var(')) {
    const m = first.match(/var\((--[A-Za-z0-9-_]+)\)/);
    if (m) {
      try {
        const resolved = getComputedStyle(document.documentElement)
          .getPropertyValue(m[1])
          .trim();
        if (resolved) {
          first = (resolved.split(',')[0] || '').trim();
        }
      } catch {
        // ignore, fall back below
      }
    }
  }

  // remove wrapping quotes if present
  return first.replace(/^['"]|['"]$/g, '') || 'Baloo';
}

/**
 * Hints the browser to load the app's primary font at a certain size/weight.
 * No-op on SSR or if FontFaceSet API is unavailable.
 */
export function loadAppFont(sizePx: number = 20, weight: string = '400'): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const fonts: any = (document as any).fonts;
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve();
  try {
    const family = getAppPrimaryFont();
    const quoted = family.includes(' ') ? `"${family}"` : family;
    return fonts.load(`${weight} ${sizePx}px ${quoted}`).then(() => {});
  } catch {
    return Promise.resolve();
  }
}
