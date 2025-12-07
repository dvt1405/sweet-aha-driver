import Phaser from 'phaser';
import {getAppFontFamily, getAppPrimaryFont} from '@/utils/fonts';

const APP_FONT_READY_EVENT = 'app-font-ready';

let appFontReady = false;
let appFontReadyPromise: Promise<void> | null = null;

/**
 * Ensure the app's primary font is requested and a one-time ready event is fired.
 */
export function ensureAppFontLoaded(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (appFontReadyPromise) return appFontReadyPromise;

  appFontReadyPromise = (async () => {
    try {
      // Hint browser to load the primary font face
      const fam = getAppPrimaryFont();
      const quoted = fam.includes(' ') ? `"${fam}"` : fam;
      // Ask for normal weight; most faces will cascade
      await (document as any).fonts?.load?.(`400 16px ${quoted}`);
      // Wait until fonts are fully ready (safety)
      if ((document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }
    } catch {
      // ignore errors, still proceed to dispatch
    }
    appFontReady = true;
    try {
      window.dispatchEvent(new CustomEvent(APP_FONT_READY_EVENT));
    } catch {
      // ignore
    }
  })();

  return appFontReadyPromise;
}

/** Returns true if the app font was reported ready. */
export function isAppFontReady(): boolean { return appFontReady; }

/** Subscribe to app font ready event. Returns an unsubscribe function. */
export function onAppFontReady(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (appFontReady) {
    try { cb(); } catch {}
    return () => {};
  }
  const handler = () => {
    try { cb(); } catch {}
  };
  window.addEventListener(APP_FONT_READY_EVENT, handler as EventListener);
  return () => window.removeEventListener(APP_FONT_READY_EVENT, handler as EventListener);
}

/**
 * Recursively refresh all Phaser Text objects starting at the provided root list.
 */
function refreshTextInObject(obj: any) {
  if (!obj) return;
  // Phaser.Text
  if (obj instanceof Phaser.GameObjects.Text) {
    obj.setFontFamily(getAppFontFamily());
    return;
  }
  // Container: traverse children
  if (obj instanceof Phaser.GameObjects.Container) {
    const children = (obj as Phaser.GameObjects.Container).list || [];
    for (const c of children) refreshTextInObject(c);
    return;
  }
}

/** Force re-apply app font to all Text objects in a Scene. */
export function refreshSceneTexts(scene: Phaser.Scene) {
  if (!scene || !scene.children) return;
  const list = (scene.children as any).list as any[];
  if (!Array.isArray(list)) return;
  for (const child of list) refreshTextInObject(child);
}

/**
 * Register the scene to automatically refresh all Text objects once the app font is ready.
 * Returns an unsubscribe to remove listeners (called automatically on scene shutdown).
 */
export function registerFontAutoRefresh(scene: Phaser.Scene): () => void {
  // Proactively start loading
  ensureAppFontLoaded().catch(() => {});

  // If ready already, refresh immediately
  if (isAppFontReady()) {
    refreshSceneTexts(scene);
    return () => {};
  }

  const off = onAppFontReady(() => {
    // Only refresh if scene is still active
    try {
      const isActive = (scene as any).sys?.isActive ?? (scene as any).sys?.settings?.active;
      if (isActive) {
        refreshSceneTexts(scene);
      } else {
        refreshSceneTexts(scene); // fallback, harmless if inactive
      }
    } catch {
      refreshSceneTexts(scene);
    }
  });

  // Clean up when scene shuts down/destroys
  const shutdown = () => off();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
  scene.events.once(Phaser.Scenes.Events.DESTROY, shutdown);
  return () => {
    off();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scene.events.off(Phaser.Scenes.Events.DESTROY, shutdown);
  };
}
