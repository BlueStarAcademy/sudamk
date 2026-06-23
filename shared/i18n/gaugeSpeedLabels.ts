import { tx } from './runtimeText.js';

const GAUGE_SPEED_KEYS: Record<number, string> = {
  1000: 'game:aiDescription.gaugeSpeedSlow',
  700: 'game:aiDescription.gaugeSpeedNormal',
  400: 'game:aiDescription.gaugeSpeedFast',
};

const GAUGE_SPEED_FALLBACK: Record<number, string> = {
  1000: 'x1 (느림)',
  700: 'x2 (보통)',
  400: 'x3 (빠름)',
};

/** Alkkagi/Curling gauge speed option label for settings display */
export function translateGaugeSpeedLabel(value: number, fallbackLabel?: string): string {
  const key = GAUGE_SPEED_KEYS[value];
  if (!key) return fallbackLabel ?? String(value);
  return tx(key, { defaultValue: fallbackLabel ?? GAUGE_SPEED_FALLBACK[value] ?? String(value) });
}
