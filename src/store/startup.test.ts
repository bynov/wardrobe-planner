import { describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { defaultProject } from '../model/defaults';
import { makeTemplate } from '../model/templates';
import type { Project } from '../model/types';
import { applyStartupUrl, consumeTemplateParam } from './startup';
import { encodeShare } from './share';
import { listProjects, saveProject } from './projects';
import { createPlannerStore } from './store';
import { memStorage } from './testStorage';

const loc = (search: string, hash = '') => ({ pathname: '/app/', search, hash });
/** Column and zone ids are freshly generated, so templates only ever match id-free. */
const shape = (p: Project): unknown => JSON.parse(JSON.stringify(p, (k, v: unknown) => (k === 'id' ? undefined : v)));

describe('consumeTemplateParam', () => {
  it('reads a known template key', () => {
    expect(consumeTemplateParam('?template=uShape')).toBe('uShape');
    expect(consumeTemplateParam('template=lShape')).toBe('lShape');
    expect(consumeTemplateParam('?lang=ru&template=oneWall')).toBe('oneWall');
  });

  it('is null for an unknown key, a missing one and nonsense', () => {
    expect(consumeTemplateParam('?template=nope')).toBeNull();
    expect(consumeTemplateParam('?template=')).toBeNull();
    expect(consumeTemplateParam('?other=1')).toBeNull();
    expect(consumeTemplateParam('')).toBeNull();
  });
});

describe('applyStartupUrl', () => {
  const withStore = () => {
    const storage = memStorage();
    return { storage, store: createPlannerStore(defaultProject(), 'en', 'mm', 'p0', storage) };
  };

  it('creates the named template project and strips the query', async () => {
    const { storage, store } = withStore();
    const replace = vi.fn();
    await applyStartupUrl(store, loc('?template=uShape'), replace);

    const p = store.getState().project;
    expect(shape(p)).toEqual(shape(makeTemplate('uShape', t('en', 'template.uShape'))));
    expect(listProjects(storage).map((m) => m.name)).toContain(t('en', 'template.uShape'));
    expect(store.getState().past).toHaveLength(0);
    expect(replace).toHaveBeenCalledWith('/app/');
  });

  it('names the template in the current language', async () => {
    const { store } = withStore();
    store.getState().setLang('ru');
    await applyStartupUrl(store, loc('?template=lShape'), vi.fn());
    expect(store.getState().project.name).toBe(t('ru', 'template.lShape'));
  });

  it('does nothing without a usable template param', async () => {
    const { store } = withStore();
    const replace = vi.fn();
    const before = store.getState().project;
    await applyStartupUrl(store, loc('?template=nope'), replace);
    expect(store.getState().project).toBe(before);
    expect(replace).not.toHaveBeenCalled();
  });

  it('replaces the starter template on a first run instead of piling up beside it', async () => {
    const { storage, store } = withStore();
    saveProject(storage, 'p0', defaultProject()); // what bootstrap stored a moment ago
    store.setState((s) => ({ ui: { ...s.ui, firstRun: true } }));
    await applyStartupUrl(store, loc('?template=oneWall'), vi.fn());
    expect(listProjects(storage)).toHaveLength(1);
    expect(listProjects(storage)[0].id).toBe(store.getState().ui.projectId);
    // The visitor who followed the link has still never seen the planner: keep the hint bar.
    expect(store.getState().ui.firstRun).toBe(true);
  });

  it('keeps the projects already stored when the run is not the first', async () => {
    const { storage, store } = withStore();
    saveProject(storage, 'p0', defaultProject());
    await applyStartupUrl(store, loc('?template=oneWall'), vi.fn());
    expect(listProjects(storage)).toHaveLength(2);
    expect(store.getState().ui.firstRun).toBe(false);
  });

  it('opens a shared design as a new project, named as shared, and strips the hash', async () => {
    const { storage, store } = withStore();
    const shared = { ...makeTemplate('uShape', 'Ann room'), name: 'Ann room' };
    const replace = vi.fn();
    await applyStartupUrl(store, loc('', '#' + (await encodeShare(shared))), replace);

    const s = store.getState();
    expect(s.project.name).toBe('Ann room' + t('en', 'ui.sharedSuffix'));
    expect(shape({ ...s.project, name: shared.name })).toEqual(shape(shared));
    expect(listProjects(storage).map((m) => m.name)).toContain(s.project.name);
    expect(s.ui.toast?.key).toBe('toast.sharedImported');
    expect(replace).toHaveBeenCalledWith('/app/');
  });

  it('replaces the untouched starter template when a shared link is the first thing opened', async () => {
    const { storage, store } = withStore();
    saveProject(storage, 'p0', defaultProject()); // what bootstrap stored a moment ago
    store.setState((s) => ({ ui: { ...s.ui, firstRun: true } }));
    await applyStartupUrl(store, loc('', '#' + (await encodeShare({ ...defaultProject(), name: 'Ann room' }))), vi.fn());

    expect(listProjects(storage)).toHaveLength(1);
    expect(listProjects(storage)[0].id).toBe(store.getState().ui.projectId);
    expect(store.getState().project.name).toBe('Ann room' + t('en', 'ui.sharedSuffix'));
    // The recipient of the link has still never seen the planner: keep the hint bar.
    expect(store.getState().ui.firstRun).toBe(true);
  });

  it('keeps the projects already stored when a shared link is not the first thing opened', async () => {
    const { storage, store } = withStore();
    saveProject(storage, 'p0', defaultProject());
    await applyStartupUrl(store, loc('', '#' + (await encodeShare({ ...defaultProject(), name: 'Ann room' }))), vi.fn());
    expect(listProjects(storage)).toHaveLength(2);
    expect(store.getState().ui.firstRun).toBe(false);
  });

  it('keeps the starter when a shared link fails to decode', async () => {
    const { storage, store } = withStore();
    saveProject(storage, 'p0', defaultProject());
    store.setState((s) => ({ ui: { ...s.ui, firstRun: true } }));
    await applyStartupUrl(store, loc('', '#p=@@@'), vi.fn());
    expect(listProjects(storage)).toHaveLength(1);
    expect(listProjects(storage)[0].id).toBe('p0');
  });

  it('names a shared design in the current language', async () => {
    const { store } = withStore();
    store.getState().setLang('ru');
    await applyStartupUrl(store, loc('', '#' + (await encodeShare({ ...defaultProject(), name: 'X' }))), vi.fn());
    expect(store.getState().project.name).toBe('X' + t('ru', 'ui.sharedSuffix'));
  });

  it('toasts and starts normally when the shared hash is damaged', async () => {
    const { store } = withStore();
    const before = store.getState().project;
    const replace = vi.fn();
    await applyStartupUrl(store, loc('', '#p=@@@'), replace);

    expect(store.getState().project).toBe(before);
    expect(store.getState().ui.toast?.key).toBe('toast.shareInvalid');
    expect(replace).toHaveBeenCalledWith('/app/');
  });

  it('leaves a hash that is not a shared design alone', async () => {
    const { store } = withStore();
    const replace = vi.fn();
    await applyStartupUrl(store, loc('', '#anchor'), replace);
    expect(store.getState().ui.toast).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('lets a shared design win over a template in the same URL', async () => {
    const { store } = withStore();
    const shared = { ...defaultProject(), name: 'Ann room' };
    await applyStartupUrl(store, loc('?template=uShape', '#' + (await encodeShare(shared))), vi.fn());
    expect(store.getState().project.name).toBe('Ann room' + t('en', 'ui.sharedSuffix'));
  });
});
