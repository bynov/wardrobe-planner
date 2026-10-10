import { useEffect, useRef } from 'react';
import { nextFocusIndex } from './focusTrap';
import { SHORTCUTS } from './shortcuts';
import { useT } from './useT';

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
        const next = nextFocusIndex(items.length, items.indexOf(document.activeElement as HTMLElement), e.shiftKey);
        if (next === null) return;
        e.preventDefault();
        items[next].focus();
        return;
      }
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // closing the dialog must not also clear the selection
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={t('ui.shortcuts')}>
        <div className="modal-head">
          <h2>{t('ui.shortcuts')}</h2>
          <button ref={closeRef} type="button" className="icon" aria-label={t('ui.close')} title={t('ui.close')} onClick={onClose}>×</button>
        </div>
        <table className="shortcuts">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td><kbd className="mono">{s.keys}</kbd></td>
                <td>{t(s.labelKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
