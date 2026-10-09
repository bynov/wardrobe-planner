import { ElevationEditor } from './ElevationEditor';
import { ErrorBanner } from './ErrorBanner';
import { Inspector } from './Inspector';
import { PresetTray } from './PresetTray';
import { WallTabs } from './WallTabs';
import { useKeyboard } from './useKeyboard';
import { useStore } from '../store/store';

/** Design mode: wall tabs on top, the elevation canvas with the preset tray beneath it, and the inspector to the right. */
export function DesignTab() {
  useKeyboard();
  const hasErrors = useStore((s) => s.errors.length > 0);
  return (
    <div className="design-modes">
      <WallTabs />
      <div className="design-body">
        <div className="design-main">
          <div className="canvas">
            <ElevationEditor />
          </div>
          <PresetTray />
        </div>
        <aside className="side">
          {hasErrors && <ErrorBanner />}
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
