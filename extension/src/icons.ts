// Lucide icons (the project's only icon set), copied from lucide-react's icon
// nodes because the extension has no React.
type IconNode = [tag: string, attrs: Record<string, string>][]

const ICONS = {
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  externalLink: [
    ['path', { d: 'M15 3h6v6' }],
    ['path', { d: 'M10 14 21 3' }],
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
  ],
  download: [
    ['path', { d: 'M12 15V3' }],
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['path', { d: 'm7 10 5 5 5-5' }],
  ],
} satisfies Record<string, IconNode>

export type IconName = keyof typeof ICONS

const SVG_NS = 'http://www.w3.org/2000/svg'

export function icon(name: IconName, size = 16, strokeWidth = 2): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  for (const [key, value] of Object.entries({
    width: String(size),
    height: String(size),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  })) {
    svg.setAttribute(key, value)
  }
  for (const [tag, attrs] of ICONS[name] as IconNode) {
    const child = document.createElementNS(SVG_NS, tag)
    for (const [key, value] of Object.entries(attrs)) child.setAttribute(key, value)
    svg.append(child)
  }
  return svg
}
