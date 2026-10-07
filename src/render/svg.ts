import { expandPrims, type Drawing, type Prim, type Stroke } from '../drawing/ir';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = (n: number) => String(Math.round(n * 100) / 100);

function strokeAttrs(stroke: Stroke | undefined): string {
  const w = stroke === 'thick' ? 2 : 1;
  const dash = stroke === 'dashed' ? ' stroke-dasharray="6 4"' : '';
  return `stroke="#111" stroke-width="${w}" vector-effect="non-scaling-stroke"${dash}`;
}

function primToSvg(p: Prim, textSize: number): string {
  switch (p.t) {
    case 'line':
      return `<line x1="${f(p.a.x)}" y1="${f(-p.a.y)}" x2="${f(p.b.x)}" y2="${f(-p.b.y)}" ${strokeAttrs(p.stroke)}/>`;
    case 'poly': {
      const pts = p.pts.map((q) => `${f(q.x)},${f(-q.y)}`).join(' ');
      const fill = p.fill === 'panel' ? '#e8e2d5' : 'none';
      return p.closed
        ? `<polygon points="${pts}" fill="${fill}" ${strokeAttrs(p.stroke)}/>`
        : `<polyline points="${pts}" fill="none" ${strokeAttrs(p.stroke)}/>`;
    }
    case 'text': {
      const size = p.size ?? textSize;
      const rot = p.rotate ? ` rotate(${f(-p.rotate)})` : '';
      return `<text transform="translate(${f(p.at.x)} ${f(-p.at.y)})${rot}" font-size="${f(size)}" text-anchor="${p.anchor ?? 'start'}" dominant-baseline="middle" fill="#111">${esc(p.text)}</text>`;
    }
    case 'dim':
      return '';
  }
}

export function drawingToSvgParts(d: Drawing): { viewBox: string; inner: string } {
  const b = d.bounds;
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const out: string[] = [];
  for (const p of expandPrims(d.prims, d.textSize, d.units)) {
    const s = primToSvg(p, d.textSize);
    if (s) out.push(s);
  }
  return { viewBox: `${f(b.min.x)} ${f(-b.max.y)} ${f(w)} ${f(h)}`, inner: out.join('\n') };
}

export function drawingToSvg(d: Drawing): string {
  const { viewBox, inner } = drawingToSvgParts(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" font-family="Helvetica, Arial, sans-serif">\n<title>${esc(d.title)}</title>\n${inner}\n</svg>`;
}
