import { msg, t } from '../i18n';
import { isTemplateKey, makeTemplate, type TemplateKey } from '../model/templates';
import { decodeShare, isShareHash } from './share';
import type { PlannerStore } from './store';

/** The query parameter that opens a ready-made example: `/app/?template=uShape`. */
export const TEMPLATE_PARAM = 'template';

/** The template a URL asks for, or `null` when it names none (or names something unknown). */
export function consumeTemplateParam(search: string): TemplateKey | null {
  const v = new URLSearchParams(search).get(TEMPLATE_PARAM);
  return isTemplateKey(v) ? v : null;
}

/** Just enough of `window.location` to act on, so this stays testable without a DOM. */
export interface StartupLocation {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Acts on the URL the app was opened with, once, before the first render, and rewrites it so a
 * reload does not do it all over again: a shared design in the hash (`#p=`/`#j=`), or a
 * `?template=` example. A shared design wins outright — it is the specific thing the link was
 * sent for, and the two never sensibly combine.
 */
export async function applyStartupUrl(
  store: PlannerStore,
  loc: StartupLocation,
  replace: (url: string) => void,
): Promise<void> {
  // Note the ordering: the only `await` here happens in this branch, which returns before the
  // first-run check below — that check reads `ui.firstRun` as it was when the app booted, and is
  // only sound while nothing has had a chance to touch the project in between.
  if (isShareHash(loc.hash)) {
    // Read before the await, for the same reason: this is the state the app booted with.
    const booted = store.getState().ui;
    const starterAtBoot = booted.firstRun ? booted.projectId : null;
    const r = await decodeShare(loc.hash);
    const { createProject, deleteProject, past, toast } = store.getState();
    if (r.ok) {
      // Named apart from the original: the recipient owns this copy, and edits stay theirs.
      createProject({ ...r.project, name: r.project.name + t(booted.lang, 'ui.sharedSuffix') });
      // `past` is empty because the first render has not happened yet, so the starter template
      // `bootstrap` stored a moment ago cannot have been edited: drop it rather than leave it
      // beside the design the link was sent for, exactly as a `?template=` link does.
      if (starterAtBoot && past.length === 0) {
        deleteProject(starterAtBoot);
        store.setState((s) => ({ ui: { ...s.ui, firstRun: true } }));
      }
      toast(msg('toast.sharedImported'));
    } else {
      // A truncated or mangled link: say so and open whatever the visitor had before.
      toast(msg('toast.shareInvalid'));
    }
    replace(loc.pathname);
    return;
  }

  const key = consumeTemplateParam(loc.search);
  if (!key) return;

  const { ui, createProject, deleteProject } = store.getState();
  const starter = ui.firstRun ? ui.projectId : null;
  createProject(makeTemplate(key, t(ui.lang, `template.${key}`)));
  if (starter) {
    // On a first run the starter template `bootstrap` just stored is untouched and was never asked
    // for: drop it rather than leave it sitting beside the one the link asked for. Opening a
    // project clears `firstRun`, but the visitor who followed the link is still new here, so the
    // hint bar is put back.
    deleteProject(starter);
    store.setState((s) => ({ ui: { ...s.ui, firstRun: true } }));
  }
  replace(loc.pathname + loc.hash);
}
