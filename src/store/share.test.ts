import { describe, expect, it } from 'vitest';
import { defaultProject } from '../model/defaults';
import { makeTemplate } from '../model/templates';
import { decodeShare, encodeShare, MAX_INFLATED_BYTES, MAX_SHARE_HASH_CHARS, ShareTooLongError, shareUrl } from './share';
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

  describe('size guards', () => {
    const toBytesB64 = (bytes: Uint8Array): string =>
      btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const deflate = async (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> =>
      new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());

    it('rejects an over-long hash without decoding it', async () => {
      expect((await decodeShare('#p=' + 'A'.repeat(MAX_SHARE_HASH_CHARS))).ok).toBe(false);
      expect((await decodeShare('#j=' + 'A'.repeat(MAX_SHARE_HASH_CHARS))).ok).toBe(false);
    });

    it('stops inflating a deflate bomb once it passes the cap', async () => {
      // A valid project padded with whitespace: without the cap this would decode to ok: true.
      const padded = serializeProject(defaultProject()) + ' '.repeat(2 * MAX_INFLATED_BYTES);
      const bomb = await deflate(new TextEncoder().encode(padded));
      expect(bomb.length).toBeLessThan(MAX_SHARE_HASH_CHARS); // small enough to pass the hash cap
      const r = await decodeShare('#p=' + toBytesB64(bomb));
      expect(r.ok).toBe(false);
    });

    it('refuses to encode a project whose link would be too long', async () => {
      const p = defaultProject();
      // incompressible name: random bytes as hex
      const noise = Array.from({ length: 40_000 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
      await expect(encodeShare({ ...p, name: noise })).rejects.toThrow(ShareTooLongError);
      await expect(encodeShare({ ...p, name: noise })).rejects.toThrow('error.shareTooLong');
    });
  });
});
