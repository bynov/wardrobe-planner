import { ElevationEditor } from './ElevationEditor';
import { Inspector } from './Inspector';
import { PlanEditor } from './PlanEditor';
import { RoomForm } from './RoomForm';
import { useKeyboard } from './useKeyboard';

export function DesignTab() {
  useKeyboard();
  return (
    <div className="design">
      <aside className="panel">
        <PlanEditor />
        <RoomForm />
      </aside>
      <ElevationEditor />
      <Inspector />
    </div>
  );
}
