import { useState } from 'react';
import { useStore } from '../store/store';
import { ErrorBanner } from './ErrorBanner';
import { PlanEditor } from './PlanEditor';
import { RoomForm } from './RoomForm';
import { clearSnapshot } from './snapshot';
import { TemplateCards, type TemplatePick } from './TemplateCards';
import { useImportJson } from './useImportJson';
import { useT } from './useT';

/** The "Room" screen: pick a starting layout, size the room and door, then go design. */
export function RoomMode() {
  const { t } = useT();
  const importJson = useImportJson();
  // Remembered with the project it produced, so opening another project clears the highlight.
  const projectId = useStore((s) => s.ui.projectId);
  const [picked, setPicked] = useState<{ key: TemplatePick; projectId: string } | null>(null);

  const onPick = (key: TemplatePick) => {
    const { past, applyTemplate } = useStore.getState();
    if (past.length > 0 && !window.confirm(t('ui.confirmTemplate'))) return;
    applyTemplate(key);
    // The cached 3D picture shows the layout just replaced; a PDF must not carry it.
    clearSnapshot();
    setPicked({ key, projectId: useStore.getState().ui.projectId });
  };

  return (
    <div className="room-mode">
      <aside className="room-left">
        <div className="room-intro">
          <h2>{t('ui.newWalkIn')}</h2>
          <p className="meta">{t('ui.newWalkInSub')}</p>
        </div>
        <TemplateCards value={picked?.projectId === projectId ? picked.key : null} onPick={onPick} />
        <p className="meta room-import">
          <button type="button" className="link" onClick={importJson.open}>{t('ui.haveFile')}</button>
        </p>
        <input {...importJson.inputProps} />
      </aside>
      <section className="room-center canvas">
        <div className="room-plan">
          <PlanEditor size="big" />
        </div>
        <div className="meta room-caption">{t('ui.planCaption')}</div>
      </section>
      <aside className="room-right">
        <div className="room-scroll">
          {/* room and door errors are caused here, so they are shown here */}
          <ErrorBanner />
          <RoomForm />
        </div>
        <div className="room-foot">
          <button type="button" className="btn primary lg" onClick={() => useStore.getState().setUi({ tab: 'design' })}>
            {t('ui.startDesigning')}
          </button>
          <p className="meta">{t('ui.privacyLine')}</p>
        </div>
      </aside>
    </div>
  );
}
