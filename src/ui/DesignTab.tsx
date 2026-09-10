import { useState } from 'react';
import { ElevationEditor } from './ElevationEditor';
import { Inspector } from './Inspector';
import { PlanEditor } from './PlanEditor';
import { RoomForm } from './RoomForm';
import { useKeyboard } from './useKeyboard';
import { useT } from './useT';
import { NARROW_QUERY, useMediaQuery } from './useMediaQuery';

export function DesignTab() {
  useKeyboard();
  const narrow = useMediaQuery(NARROW_QUERY);
  const { t } = useT();
  // On a phone the room settings are a long form between the plan and the elevation, so they start
  // folded away and the elevation is what the user lands on; on a wide screen the summary is hidden
  // and the panel is always open — including after the user collapsed it on a phone and then
  // widened the window, which is why `open` is forced rather than left to the element's own state.
  // Forcing it also fires `toggle`, so only a phone-width toggle may write the state back.
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="design">
      <aside className="panel">
        <PlanEditor />
        <details
          className="settings"
          open={narrow ? settingsOpen : true}
          onToggle={(e) => {
            if (narrow) setSettingsOpen(e.currentTarget.open);
          }}
        >
          <summary>{t('ui.settingsSummary')}</summary>
          <RoomForm />
        </details>
      </aside>
      <ElevationEditor />
      <Inspector />
    </div>
  );
}
