export interface SitePage {
  file: string;
  url: string;
  lang: 'en' | 'ru';
  kind: 'landing' | 'guide';
}

export const ORIGIN = 'https://walkinplanner.com';

export const PAGES: SitePage[] = [
  { file: 'index.html', url: '/', lang: 'en', kind: 'landing' },
  { file: 'ru/index.html', url: '/ru/', lang: 'ru', kind: 'landing' },
  { file: 'guides/wardrobe-dimensions/index.html', url: '/guides/wardrobe-dimensions/', lang: 'en', kind: 'guide' },
  { file: 'guides/hanging-rail-height/index.html', url: '/guides/hanging-rail-height/', lang: 'en', kind: 'guide' },
  {
    file: 'guides/shelf-depth-and-spacing/index.html',
    url: '/guides/shelf-depth-and-spacing/',
    lang: 'en',
    kind: 'guide',
  },
  {
    file: 'guides/walk-in-closet-minimum-width/index.html',
    url: '/guides/walk-in-closet-minimum-width/',
    lang: 'en',
    kind: 'guide',
  },
];

export const GOATCOUNTER =
  '<script data-goatcounter="https://walkinplanner.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>';
