import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOATCOUNTER, ORIGIN, PAGES } from './pages';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(resolve(root, f), 'utf8');
const one = (html: string, re: RegExp) => {
  const m = html.match(re);
  expect(m, String(re)).not.toBeNull();
  return m![1];
};

describe('site pages', () => {
  for (const p of PAGES) {
    describe(p.url, () => {
      const html = read(p.file);
      it('has title, description, canonical, viewport, OG, twitter, favicon, analytics', () => {
        expect(html).toContain('<meta charset="UTF-8"');
        const title = one(html, /<title>([^<]+)<\/title>/);
        expect(title.length).toBeLessThanOrEqual(60);
        expect(title.toLowerCase()).toContain(p.lang === 'en' ? 'walk-in' : 'гардероб');
        expect((html.match(/<title>/g) ?? []).length).toBe(1);
        const desc = one(html, /<meta name="description" content="([^"]+)"/);
        expect(desc.length).toBeLessThanOrEqual(155);
        expect(one(html, /<link rel="canonical" href="([^"]+)"/)).toBe(ORIGIN + p.url);
        expect(html).toMatch(/<meta name="viewport"/);
        expect(html).toMatch(/<meta name="theme-color"/);
        for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type'])
          expect(html, k).toContain(`property="${k}"`);
        expect(one(html, /<meta property="og:url" content="([^"]+)"/)).toBe(ORIGIN + p.url);
        expect(one(html, /<meta property="og:image" content="([^"]+)"/)).toMatch(/^https:\/\//);
        expect(html).toContain('name="twitter:card" content="summary_large_image"');
        expect(html).toContain('rel="icon"');
        expect(html).toContain(GOATCOUNTER);
        expect(html).toMatch(new RegExp(`<html lang="${p.lang}"`));
      });
      it('JSON-LD parses and matches the page kind', () => {
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
          JSON.parse(m[1]),
        );
        const types = blocks.map((b) => b['@type']);
        expect(types).toContain('FAQPage');
        expect(types).toContain(p.kind === 'landing' ? 'SoftwareApplication' : 'Article');
        const summaries = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) =>
          m[1].replace(/\s+/g, ' ').trim(),
        );
        const faq = blocks.find((b) => b['@type'] === 'FAQPage');
        for (const q of faq.mainEntity) expect(summaries, q.name).toContain(q.name);
      });
      it('internal links resolve to files', () => {
        const hrefs = [...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]);
        for (const h of hrefs) {
          if (h === '/app/') continue; // built by Vite from app/index.html
          const file = h.endsWith('/') ? `${h.slice(1)}index.html` : h.slice(1);
          const inPublic = existsSync(resolve(root, 'public', file));
          expect(inPublic || existsSync(resolve(root, file)), h).toBe(true);
        }
      });
      if (p.kind === 'landing')
        it('has hreflang en, ru, x-default', () => {
          for (const l of ['en', 'ru', 'x-default']) expect(html).toContain(`hreflang="${l}"`);
        });
    });
  }
  it('sitemap lists exactly the pages', () => {
    const xml = read('public/sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    expect(locs).toEqual(PAGES.map((p) => ORIGIN + p.url).sort());
  });
  it('robots points at the sitemap', () => {
    expect(read('public/robots.txt')).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
  it('llms.txt exists and names the product', () => {
    expect(read('public/llms.txt')).toContain('Walk-in Planner');
  });
});
