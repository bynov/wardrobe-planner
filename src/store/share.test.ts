import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { makeTemplate } from '../model/templates';
import { decodeShare, encodeShare, shareUrl } from './share';
import { serializeProject } from './persist';

/** What the `j=` fallback branch produces, built here independently of the module under test. */
const base64url = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('share encoding', () => {
  it('round-trips a project', async () => {
    const p = defaultProject();
    const r = await decodeShare(await encodeShare(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });

  it('compresses where CompressionStream exists, in a URL-safe charset', async () => {
    const enc = await encodeShare(defaultProject());
    expect(enc.startsWith('p=')).toBe(true);
    expect(enc).toMatch(/^[A-Za-z0-9_\-=]+$/);
  });

  it('keeps the default project well under a URL length limit', async () => {
    const enc = await encodeShare(defaultProject());
    expect(enc.length).toBeLessThan(1500);
  });

  it('reads the uncompressed fallback form', async () => {
    const p = makeTemplate('lShape', 'L');
    const r = await decodeShare('#j=' + base64url(serializeProject(p)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });

  it('accepts a hash with or without its leading #', async () => {
    const enc = await encodeShare(defaultProject());
    const a = await decodeShare(enc);
    const b = await decodeShare('#' + enc);
    expect([a.ok, b.ok]).toEqual([true, true]);
  });

  it('rejects garbage, an empty hash and an unknown prefix', async () => {
    for (const h of ['#p=@@@', '#j=@@@', '', '#', '#p=', '#x=abc', '#p=' + base64url('not a project')]) {
      expect((await decodeShare(h)).ok, h).toBe(false);
    }
  });

  it('builds the link from the page origin and path', () => {
    expect(shareUrl({ origin: 'https://walkinplanner.com', pathname: '/app/' }, 'p=AAA')).toBe(
      'https://walkinplanner.com/app/#p=AAA',
    );
  });
});
