/** 日報の時間の決まり。バックエンドの rules.py と同じ内容にそろえる。 */
export const MIN_HOURS = 0.25;
export const MAX_HOURS = 24;
export const STEP = 0.25;

export function validateHours(hours: number): string | null {
  if (Number.isNaN(hours)) return '数字で入力してください';
  if (hours < MIN_HOURS || hours > MAX_HOURS) return '0.25〜24時間で入力してください';
  if (!Number.isInteger(hours * 4)) return '15分単位で入力してください';
  return null;
}

/** ±ボタン用。15分ずつ動かし、0.25〜24 の外には出さない。 */
export function stepHours(hours: number, direction: 1 | -1): number {
  const next = hours + STEP * direction;
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, next));
}
