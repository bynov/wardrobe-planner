import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Project } from '../../model/types';
import { cacheSnapshot, encodeCanvas } from '../snapshot';
import { Viewport3D } from './Viewport3D';

/** Off-screen host size: the same 3:2 the PDF's picture box wants, big enough not to look soft. */
const HOST_WIDTH = 1200;
const HOST_HEIGHT = 800;
/** A WebGL context that never comes up must not hang the export behind the busy button. */
const SNAPSHOT_TIMEOUT_MS = 5000;

/**
 * Renders the project into a throwaway viewport parked off-screen and captures its first frame.
 * This is the fallback for an export from a session that never opened the 3D tab, so there is no
 * live canvas and nothing cached: the PDF would otherwise print "no preview".
 *
 * The mount is torn down in `finally` — unmounting R3F disposes the renderer and releases the
 * WebGL context, so repeated exports do not pile contexts up until the browser drops the oldest.
 */
export async function renderSnapshot(project: Project, timeoutMs = SNAPSHOT_TIMEOUT_MS): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${HOST_WIDTH}px;height:${HOST_HEIGHT}px;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const firstFrame = new Promise<'frame'>((resolve) => {
      root.render(
        createElement(Viewport3D, { project, snapshotOnly: true, onFirstFrame: () => resolve('frame') }),
      );
    });
    let timer = 0;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = window.setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const outcome = await Promise.race([firstFrame, timeout]);
    window.clearTimeout(timer);
    if (outcome === 'timeout') return null;
    // `useFrame` subscribers run before R3F draws, so the buffer is still empty when the first
    // frame reports in; one more animation frame puts the drawn image on it.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const canvas = host.querySelector('canvas');
    return canvas ? encodeCanvas(canvas) : null;
  } catch {
    // A refused context, a lost one, a scene that threw: the PDF says the preview is missing.
    return null;
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * The picture for the PDF: whatever the live viewport has shown (so an orbited view is the one
 * that gets printed), and only failing that an off-screen render of the project itself.
 */
export async function takeSnapshot(project: Project): Promise<string | null> {
  return cacheSnapshot() ?? renderSnapshot(project);
}
