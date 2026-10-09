import { useEffect } from 'react';
import { useStore } from './store/store';
import { TopBar } from './ui/TopBar';
import { HintBar } from './ui/HintBar';
import { Toast } from './ui/Toast';
import { RoomMode } from './ui/RoomMode';
import { DesignTab } from './ui/DesignTab';
import { CutListTable } from './ui/CutListTable';
import { Viewport3D } from './ui/three/Viewport3D';
import { StaleBanner } from './ui/StaleBanner';
import { MobileShell } from './ui/MobileShell';
import { PHONE_QUERY, useMediaQuery } from './ui/useMediaQuery';

export function App() {
  const tab = useStore((s) => s.ui.tab);
  const lang = useStore((s) => s.ui.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const phone = useMediaQuery(PHONE_QUERY);
  if (phone) {
    return (
      <>
        <MobileShell />
        <Toast />
      </>
    );
  }
  return (
    <div className="app">
      <TopBar />
      {tab === 'design' && <HintBar />}
      <main className="content">
        {tab === 'setup' && <RoomMode />}
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
