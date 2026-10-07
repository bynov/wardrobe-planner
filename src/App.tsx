import { useEffect } from 'react';
import { useStore } from './store/store';
import { TopBar } from './ui/TopBar';
import { HintBar } from './ui/HintBar';
import { Toast } from './ui/Toast';
import { DesignTab } from './ui/DesignTab';
import { CutListTable } from './ui/CutListTable';
import { Viewport3D } from './ui/three/Viewport3D';
import { useT } from './ui/useT';

/**
 * The 3D view and the cut list are built from `lastValid`, so while the project has validation
 * errors they show something the design tab no longer matches. Say so above them.
 */
function StaleBanner() {
  const n = useStore((s) => s.errors.length);
  const { t } = useT();
  return n > 0 ? <div className="stale">{t('ui.showingLastValid', { n })}</div> : null;
}

export function App() {
  const tab = useStore((s) => s.ui.tab);
  const lang = useStore((s) => s.ui.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <div className="app">
      <TopBar />
      <HintBar />
      <main className="content">
        {tab === 'design' && <DesignTab />}
        {tab === '3d' && (
          <div className="tabpane">
            <StaleBanner />
            <Viewport3D />
          </div>
        )}
        {tab === 'cutlist' && (
          <div className="tabpane">
            <StaleBanner />
            <CutListTable />
          </div>
        )}
      </main>
      <Toast />
    </div>
  );
}
