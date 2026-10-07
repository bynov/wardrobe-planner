import { msg } from '../i18n';
import type { Project } from '../model/types';
import { parseProjectShape, serializeProject, type ParseResult } from './persist';

/**
 * A whole design carried in a link, with no server behind it: the project JSON is deflated and
 * base64url-encoded into the URL hash, which browsers never send anywhere. The prefix says which
 * form the payload is in, so an old link keeps working when the encoder changes.
 *
 * `p=` deflate-raw (what every current browser produces); `j=` the plain JSON fallback for a
 * browser without `CompressionStream`.
 */
const SHARE_DEFLATE = 'p=';
const SHARE_PLAIN = 'j=';
/** deflate without the zlib/gzip wrapper: the smallest of the three for a payload this size. */
const FORMAT = 'deflate-raw';

const stripHash = (hash: string): string => (hash.startsWith('#') ? hash.slice(1) : hash);

/** True for a hash this module can try to read, so other hashes (a plain anchor) are left alone. */
export function isShareHash(hash: string): boolean {
  const body = stripHash(hash);
  return body.startsWith(SHARE_DEFLATE) || body.startsWith(SHARE_PLAIN);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Throws on anything that is not base64url — the callers all treat that as an unreadable link. */
function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Compression streams are DOM-typed but exist in Node too; absent on older Safari, hence `j=`. */
const compression = (): typeof CompressionStream | undefined =>
  (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream;
const decompression = (): typeof DecompressionStream | undefined =>
  (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;

async function pump(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

/** The hash body of a link that opens `p`: prefix + base64url payload, no leading `#`. */
export async function encodeShare(p: Project): Promise<string> {
  const bytes = new TextEncoder().encode(serializeProject(p));
  const CS = compression();
  if (!CS) return SHARE_PLAIN + toBase64Url(bytes);
  return SHARE_DEFLATE + toBase64Url(await pump(bytes, new CS(FORMAT)));
}

/** Reads a hash written by `encodeShare` (with or without its `#`). Never throws. */
export async function decodeShare(hash: string): Promise<ParseResult> {
  const body = stripHash(hash);
  const bad: ParseResult = { ok: false, error: msg('error.badShareLink') };
  try {
    let text: string;
    if (body.startsWith(SHARE_DEFLATE)) {
      const DS = decompression();
      if (!DS) return bad;
      text = new TextDecoder().decode(await pump(fromBase64Url(body.slice(SHARE_DEFLATE.length)), new DS(FORMAT)));
    } else if (body.startsWith(SHARE_PLAIN)) {
      text = new TextDecoder().decode(fromBase64Url(body.slice(SHARE_PLAIN.length)));
    } else {
      return bad;
    }
    return parseProjectShape(text);
  } catch {
    // bad base64, a payload that is not deflated, or one that inflates to something else
    return bad;
  }
}

/** The link to hand out, on whatever origin and path the app is served from. */
export function shareUrl(loc: { origin: string; pathname: string }, encoded: string): string {
  return `${loc.origin}${loc.pathname}#${encoded}`;
}
