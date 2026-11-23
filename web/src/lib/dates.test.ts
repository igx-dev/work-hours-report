import { addDays, addMonths, currentMonth, formatDay, monthLabel, todayIso } from './dates';

const NOON_JST = new Date('2027-01-12T03:00:00Z'); // 日本時間 12:00

describe('日付の計算', () => {
  test('今日と今月は日本時間で決まる', () => {
    expect(todayIso(NOON_JST)).toBe('2027-01-12');
    expect(currentMonth(NOON_JST)).toBe('2027-01');
    // 日本時間ではもう翌日(UTC では前日の 15:30)
    expect(todayIso(new Date('2027-01-31T15:30:00Z'))).toBe('2027-02-01');
  });

  test('月を前後に動かせる(年をまたぐ)', () => {
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-12', +1)).toBe('2027-01');
    expect(addMonths('2027-01', -5)).toBe('2026-08');
  });

  test('表示用の文字', () => {
    expect(monthLabel('2027-01')).toBe('2027年1月');
    expect(formatDay('2027-01-12')).toBe('1/12(火)');
  });
});

test('日を前後に動かせる(月や年をまたぐ)', () => {
  expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
});
