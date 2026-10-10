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

/** A real link is about 1 kB; browsers and chat apps keep URLs well under this. */
export const MAX_SHARE_HASH_CHARS = 32_000;
/** A project is tens of kB of JSON; anything inflating past this is a bomb or not a project. */
export const MAX_INFLATED_BYTES = 1_000_000;

/** `encodeShare` result too long for a link; the message is the i18n key for the toast. */
export class ShareTooLongError extends Error {
  constructor() {
    super('error.shareTooLong');
  }
}

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
  const body = SHARE_DEFLATE + toBase64Url(await pump(bytes, new CS(FORMAT)));
  if (body.length > MAX_SHARE_HASH_CHARS) throw new ShareTooLongError();
  return body;
}

/** Inflates chunk by chunk and cancels as soon as the total passes the cap; null means too big. */
async function inflateCapped(bytes: Uint8Array<ArrayBuffer>, ds: DecompressionStream): Promise<Uint8Array | null> {
  const reader = new Blob([bytes]).stream().pipeThrough(ds).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_INFLATED_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Reads a hash written by `encodeShare` (with or without its `#`). Never throws. */
export async function decodeShare(hash: string): Promise<ParseResult> {
  const body = stripHash(hash);
  const bad: ParseResult = { ok: false, error: msg('error.badShareLink') };
  if (body.length > MAX_SHARE_HASH_CHARS) return bad;
  try {
    let text: string;
    if (body.startsWith(SHARE_DEFLATE)) {
      const DS = decompression();
      if (!DS) return bad;
      const inflated = await inflateCapped(fromBase64Url(body.slice(SHARE_DEFLATE.length)), new DS(FORMAT));
      if (!inflated) return bad;
      text = new TextDecoder().decode(inflated);
    } else if (body.startsWith(SHARE_PLAIN)) {
      const bytes = fromBase64Url(body.slice(SHARE_PLAIN.length));
      if (bytes.length > MAX_INFLATED_BYTES) return bad;
      text = new TextDecoder().decode(bytes);
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
