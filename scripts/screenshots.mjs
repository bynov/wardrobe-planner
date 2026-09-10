#!/usr/bin/env node
/**
 * Marketing screenshots for the landing pages and the README.
 *
 * Serves `dist/` and drives the system Chrome over the DevTools Protocol (Node's built-in
 * WebSocket + fetch — no Playwright, no extra dependency, no browser download). Writes
 * `public/screenshots/{design,3d,cutlist,mobile}.png` and `public/og.png`.
 *
 *     pnpm build && pnpm screenshots
 *
 * Chrome is looked up at CHROME, else the standard macOS location.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const shotDir = join(root, 'public', 'screenshots');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const OG_TITLE = 'Walk-in Planner';
const OG_SUB = 'free walk-in wardrobe planner';

/** The og image: design.png cropped (cover, top-aligned) under a dark title band. */
const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden;background:#0f172a}
  .wrap{position:relative;width:1200px;height:630px}
  img{width:1200px;height:630px;object-fit:cover;object-position:top center;display:block}
  .band{position:absolute;left:0;right:0;bottom:0;padding:52px 44px 34px;
    background:linear-gradient(to top,#0f172a 0,#0f172a 62%,rgba(15,23,42,0) 100%);
    font:400 28px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#cbd5e1}
  .band b{display:block;font-weight:700;font-size:52px;line-height:1.1;color:#fff;letter-spacing:-.5px}
</style></head><body><div class="wrap">
  <img src="./design.png" alt="">
  <div class="band"><b>${OG_TITLE}</b>${OG_SUB}</div>
</div></body></html>`;

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

// ---------------------------------------------------------------- static server

function serveDist() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    // The og page is generated here so it can point at the screenshot we just wrote,
    // which is newer than anything in dist/.
    if (path === '/__og/' || path === '/__og/index.html') {
      res.writeHead(200, { 'content-type': MIME['.html'] }).end(ogHtml);
      return;
    }
    if (path === '/__og/design.png') {
      res.writeHead(200, { 'content-type': MIME['.png'] }).end(readFileSync(join(shotDir, 'design.png')));
      return;
    }
    if (path.endsWith('/')) path += 'index.html';
    let file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file) || !extname(file)) {
      // SPA-ish fallback: anything unresolved under /app/ is the app shell.
      if (path.startsWith('/app/')) file = join(dist, 'app', 'index.html');
      else {
        res.writeHead(404, { 'content-type': MIME['.txt'] }).end('not found');
        return;
      }
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

// ---------------------------------------------------------------- chrome + CDP

function launchChrome(profile) {
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--window-size=1440,900',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--force-device-scale-factor=1',
      // WebGL for the 3D tab without a GPU.
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const ws = new Promise((ok, fail) => {
    let buf = '';
    const t = setTimeout(() => fail(new Error(`Chrome did not report a DevTools endpoint:\n${buf}`)), 30_000);
    child.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(t);
        ok(m[1]);
      }
    });
    child.on('error', (e) => {
      clearTimeout(t);
      fail(e);
    });
    child.on('exit', (code) => {
      clearTimeout(t);
      fail(new Error(`Chrome exited (${code}):\n${buf}`));
    });
  });
  return { child, ws };
}

/** Minimal CDP client over one page target. */
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        msg.error ? p.fail(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`)) : p.ok(msg.result);
      } else {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
    // A crashed Chrome closes the socket without answering: fail everything in flight, so the run
    // stops with an error instead of hanging on promises that can never settle.
    const abort = () => {
      const err = new Error('CDP socket closed');
      for (const p of this.pending.values()) p.fail(err);
      this.pending.clear();
    };
    socket.addEventListener('close', abort);
    socket.addEventListener('error', abort);
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((ok, fail) => {
      socket.addEventListener('open', ok, { once: true });
      socket.addEventListener('error', () => fail(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new Cdp(socket);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, fail) => this.pending.set(id, { ok, fail }));
  }
  once(method) {
    return new Promise((ok) => {
      const fn = (p) => {
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((f) => f !== fn));
        ok(p);
      };
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), fn]);
    });
  }
  /** Runs `expr` in the page; `expr` may evaluate to a promise. Throws on a page-side error. */
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Page-side poll for a condition, as a promise `eval` can await. */
const waitFor = (js, what, ms = 20_000) => `new Promise((ok, fail) => {
  const t0 = Date.now();
  const tick = () => {
    try { if (${js}) return ok(true); } catch (e) { return fail(e); }
    if (Date.now() - t0 > ${ms}) return fail(new Error(${JSON.stringify(`timed out waiting for ${what}`)}));
    setTimeout(tick, 100);
  };
  tick();
})`;

// ---------------------------------------------------------------- shots

async function main() {
  if (!existsSync(dist)) die('dist/ is missing — run pnpm build first');
  if (!existsSync(CHROME)) die(`Chrome not found at ${CHROME} — set CHROME=/path/to/chrome`);
  mkdirSync(shotDir, { recursive: true });

  const { server, port } = await serveDist();
  const origin = `http://127.0.0.1:${port}`;
  const profile = mkdtempSync(join(tmpdir(), 'wp-shots-'));
  const chrome = launchChrome(profile);
  let cdp;
  // Chrome, the server and the throwaway profile must go whether the run finishes, throws or is
  // interrupted — and exactly once, since `finally` and a signal can both get here.
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      cdp?.socket.close();
    } catch {}
    chrome.child.kill('SIGKILL');
    server.close();
    // Chrome is still flushing its profile as it dies, so the first removal can hit ENOTEMPTY;
    // retry a few times and, failing that, leave the temp dir to the OS rather than fail a
    // finished run over it.
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {}
  };
  const onSignal = () => {
    cleanup();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    const browserWs = await chrome.ws;
    const devtoolsPort = new URL(browserWs).port;
    const targets = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');
    cdp = await Cdp.connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const metrics = (width, height, mobile) =>
      cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });

    const goto = async (url) => {
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url });
      await loaded;
    };

    const shot = async (file) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(`wrote ${file}`);
    };

    /**
     * Every shot starts from a clean slate so `?template=` decides what is on screen. Units are
     * pinned to mm: the browser's locale would otherwise pick inches here, and a picture full of
     * sixteenths reads far worse than round millimetres on both landings.
     */
    const freshApp = async (query) => {
      await goto(`${origin}/`);
      await cdp.eval(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('wardrobe-planner:units', 'mm');
        localStorage.setItem('wardrobe-planner:lang', 'en');
        return true;
      })()`);
      await goto(`${origin}/app/${query}`);
      await cdp.eval(waitFor("document.querySelector('.design svg')", 'the design drawing'));
      await cdp.eval(`(() => {
        const b = document.querySelector('.hintbar button');
        if (b) b.click();
        return true;
      })()`);
      await sleep(300);
    };

    const clickTab = async (i) => {
      await cdp.eval(`(() => {
        const nav = document.querySelector('.topbar nav.tabs:not(.lang):not(.units)');
        if (!nav) throw new Error('tab bar not found');
        nav.children[${i}].click();
        return true;
      })()`);
    };

    // --- desktop: design, 3d, cut list
    await metrics(1440, 900, false);
    await freshApp('?template=uShape');
    // Select a unit so the inspector shows the zone editor rather than the empty-state hint.
    await cdp.eval(`(() => {
      const hits = document.querySelectorAll('.elevation svg rect.hit');
      if (!hits.length) throw new Error('no unit to select');
      hits[Math.min(3, hits.length - 1)].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    })()`);
    await sleep(300);
    await shot(join(shotDir, 'design.png'));

    await clickTab(1);
    await cdp.eval(waitFor("document.querySelector('.viewport canvas')", 'the 3D canvas'));
    // The dimension callouts crowd each other from this camera; the clean render reads better.
    await cdp.eval(`(() => {
      const dims = document.querySelector('.viewport .controls input[type=checkbox]');
      if (dims && dims.checked) dims.click();
      return true;
    })()`);
    await sleep(1500); // let the scene draw and the controls settle
    await shot(join(shotDir, '3d.png'));

    await clickTab(2);
    await cdp.eval(waitFor("document.querySelector('table.cutlist tbody tr')", 'the cut list'));
    await sleep(300);
    await shot(join(shotDir, 'cutlist.png'));

    // --- phone: design
    await metrics(390, 844, true);
    await freshApp('?template=uShape');
    await shot(join(shotDir, 'mobile.png'));

    // --- og image
    await metrics(1200, 630, false);
    await goto(`${origin}/__og/`);
    await cdp.eval(waitFor("[...document.images].every((i) => i.complete && i.naturalWidth > 0)", 'the og image'));
    await sleep(200);
    await shot(join(root, 'public', 'og.png'));
  } finally {
    cleanup();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
