/**
 * Money is stored as integer minor units (cents) to avoid floating-point drift.
 * These helpers convert at the API boundary only.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function toMajorUnits(cents: number): number {
  return Math.round(cents) / 100;
}

/** Zero-padded sequence formatter, e.g. (7) -> "0007". */
export function padSequence(value: number, width = 4): string {
  return String(value).padStart(width, '0');
}
