import { useEffect } from 'react';
import { useStore } from '../store/store';
import { useT } from './useT';

export function Toast() {
  const msg = useStore((s) => s.ui.toast);
  const toast = useStore((s) => s.toast);
  const { tmDeep } = useT();
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => toast(null), 4000);
    return () => clearTimeout(id);
  }, [msg, toast]);
  return msg ? <div className="toast">{tmDeep(msg)}</div> : null;
}
