import { useStore } from '../store/store';
import { BottomSheet } from './BottomSheet';
import { CutListTable } from './CutListTable';
import { ElevationEditor } from './ElevationEditor';
import { IconButton } from './controls';
import { Logo } from './Logo';
import { MobileNav } from './MobileNav';
import { PlanEditor } from './PlanEditor';
import { ProjectsMenu } from './ProjectsMenu';
import { RoomMode } from './RoomMode';
import { StaleBanner } from './StaleBanner';
import { nextTheme } from './theme';
import { useKeyboard } from './useKeyboard';
import { useT } from './useT';
import { WallChips } from './WallChips';
import { Viewport3D } from './three/Viewport3D';

/** Phone shell (<= 600px): compact header, the active mode, and the bottom navigation. */
export function MobileShell() {
  const tab = useStore((s) => s.ui.tab);
  const theme = useStore((s) => s.ui.theme);
  const open = useStore((s) => s.ui.sheetOpen);
  const canUndo = useStore((s) => s.past.length > 0);
  const { setTheme, undo } = useStore.getState();
  const { t } = useT();
  useKeyboard();

  return (
    <div className="mshell">
      <header className="mhead">
        <Logo />
        <ProjectsMenu />
        <IconButton label={t('ui.undo')} onClick={undo} disabled={!canUndo}>↶</IconButton>
        <button type="button" className="icon" aria-label={t('ui.themeToggle')} title={t('ui.themeToggle')} onClick={() => setTheme(nextTheme(theme))}>
          <span className="theme-glyph" aria-hidden />
        </button>
      </header>
      <main className="mbody">
        {tab === 'design' && (
          <div className={`mdesign${open ? ' open' : ''}`}>
            <WallChips />
            <div className="canvas mcanvas">
              <ElevationEditor />
              <div className="mplan"><PlanEditor size="thumb" /></div>
            </div>
            <BottomSheet />
          </div>
        )}
        {tab === 'setup' && <RoomMode />}
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
      <MobileNav />
    </div>
  );
}
