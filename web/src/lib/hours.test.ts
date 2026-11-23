import { stepHours, validateHours } from './hours';

describe('validateHours(時間の入力チェック)', () => {
  test('15分単位でない時間はエラー', () => {
    expect(validateHours(1.1)).toBe('15分単位で入力してください');
  });

  test('0.25〜24時間は OK', () => {
    expect(validateHours(0.25)).toBeNull();
    expect(validateHours(24)).toBeNull();
  });

  test('0時間や24時間を超える時間はエラー', () => {
    expect(validateHours(0)).toBe('0.25〜24時間で入力してください');
    expect(validateHours(24.25)).toBe('0.25〜24時間で入力してください');
  });

  test('数字でない入力はエラー', () => {
    expect(validateHours(Number.NaN)).toBe('数字で入力してください');
  });
});

describe('stepHours(±ボタン)', () => {
  test('15分ずつ増やしたり減らしたりできる', () => {
    expect(stepHours(1, +1)).toBe(1.25);
    expect(stepHours(1, -1)).toBe(0.75);
  });

  test('0.25より下や24より上には行かない', () => {
    expect(stepHours(0.25, -1)).toBe(0.25);
    expect(stepHours(24, +1)).toBe(24);
  });
});
