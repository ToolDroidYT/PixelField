import type { PixelFieldConfig } from '@tooldroid/pixel-field';
import { formatNumber } from './format';

/**
 * Key order shared by both snippet builders; mirrors the declaration order in
 * `demoConfig.ts` so exports read the way the demo is written.
 */
const CONFIG_KEYS: (keyof PixelFieldConfig)[] = [
  'spacing',
  'pixelSize',
  'sizeJitter',
  'speed',
  'maxFps',
  'visibilityRange',
  'alphaCap',
  'glint',
  'colorBase',
  'colorRange',
  'glintColor',
];

function formatValue(value: unknown): string | null {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const channels = value.map((channel: number) => formatNumber(channel));
    return `[${channels.join(', ')}]`;
  }
  return null;
}

/** `key: value` lines for every key the config actually sets. */
function configEntries(config: PixelFieldConfig): string[] {
  const entries: string[] = [];
  for (const key of CONFIG_KEYS) {
    const value: unknown = config[key];
    if (value === undefined) continue;
    const text = formatValue(value);
    if (text !== null) entries.push(`  ${key}: ${text},`);
  }
  return entries;
}

function configBlock(config: PixelFieldConfig): string[] {
  return [
    'const PIXEL_FIELD_CONFIG = {',
    ...configEntries(config),
    '} satisfies PixelFieldConfig;',
  ];
}

/** A ready-to-paste `PixelFieldConfig` object with the current values. */
export function buildConfigSnippet(config: PixelFieldConfig): string {
  return [
    "import { type PixelFieldConfig } from '@tooldroid/pixel-field';",
    '',
    ...configBlock(config),
  ].join('\n');
}

/** The full quick-start example: config, import, and the component. */
export function buildUsageSnippet(
  config: PixelFieldConfig,
  seed: number,
): string {
  return [
    "import { PixelField, type PixelFieldConfig } from '@tooldroid/pixel-field';",
    '',
    ...configBlock(config),
    '',
    'export function Field() {',
    `  return <PixelField running seed={${formatNumber(seed)}} config={PIXEL_FIELD_CONFIG} />;`,
    '}',
  ].join('\n');
}
