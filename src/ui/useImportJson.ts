import { useRef, type ChangeEvent } from 'react';
import { useStore } from '../store/store';
import { parseErrorText, parseProjectShape } from '../store/persist';
import { clearSnapshot } from './snapshot';

/**
 * JSON import shared by the "⋯" menu and Room mode. The caller renders a hidden
 * `<input type="file" {...inputProps} />` (outside any menu that closes) and calls `open()`.
 */
export function useImportJson() {
  const ref = useRef<HTMLInputElement>(null);

  const load = async (file: File | undefined) => {
    if (!file) return;
    const { toast, createProject, ui: { lang, units } } = useStore.getState();
    // A shape-valid file is always loaded, even when it fails validation: the design tab lists the
    // errors and the user fixes them there — rejecting the file outright left them nothing to edit.
    // It lands as a new project: overwriting the open one would let autosave bury it.
    const r = parseProjectShape(await file.text());
    if (!r.ok) {
      toast({ key: 'toast.importFailed', params: { error: parseErrorText(lang, r, units) } });
      return;
    }
    clearSnapshot();
    createProject(r.project);
    const n = useStore.getState().errors.length;
    toast(n ? { key: 'toast.importedWithErrors', params: { n } } : { key: 'toast.imported' });
  };

  return {
    inputProps: {
      ref,
      type: 'file' as const,
      accept: 'application/json,.json',
      hidden: true,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        void load(e.target.files?.[0]);
        e.target.value = '';
      },
    },
    open: () => ref.current?.click(),
  };
}
