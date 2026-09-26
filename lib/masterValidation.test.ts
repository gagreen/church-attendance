import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  isValidEnrolledDate,
  normalizeClassIds,
  normalizeEmail,
  normalizeName,
  parseGrade,
} from '@/lib/masterValidation';

const ID_A = '11111111-1111-1111-1111-111111111111';
const ID_B = '22222222-2222-2222-2222-222222222222';

describe('normalizeEmail / isValidEmail', () => {
  it('앞뒤 공백을 지우고 소문자로 통일한다', () => {
    expect(normalizeEmail('  Park@Gmail.COM ')).toBe('park@gmail.com');
  });
  it('명백히 잘못된 이메일을 거른다', () => {
    expect(isValidEmail('park@gmail.com')).toBe(true);
    expect(isValidEmail('park@gmail')).toBe(false);
    expect(isValidEmail('park gmail.com')).toBe(false);
    expect(isValidEmail('a@@b.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('normalizeName', () => {
  it('공백을 정리하고, 비었거나 너무 길면 null', () => {
    expect(normalizeName('  김철수 ')).toBe('김철수');
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('가'.repeat(51))).toBeNull();
    expect(normalizeName(123)).toBeNull();
  });
});

describe('normalizeClassIds', () => {
  it('중복을 제거하고 UUID가 아닌 값이 섞이면 null', () => {
    expect(normalizeClassIds([ID_A, ID_B, ID_A])).toEqual([ID_A, ID_B]);
    expect(normalizeClassIds([])).toEqual([]);
    expect(normalizeClassIds([ID_A, 'not-a-uuid'])).toBeNull();
    expect(normalizeClassIds('x')).toBeNull();
  });
});

describe('parseGrade', () => {
  it('미지정은 null, 유효한 학년은 그대로, 그 외는 실패', () => {
    expect(parseGrade(undefined)).toEqual({ ok: true, grade: null });
    expect(parseGrade('')).toEqual({ ok: true, grade: null });
    expect(parseGrade('중2')).toEqual({ ok: true, grade: '중2' });
    expect(parseGrade('초3')).toEqual({ ok: false });
  });
});

describe('isValidEnrolledDate', () => {
  it('실제로 존재하는 YYYY-MM-DD만 통과', () => {
    expect(isValidEnrolledDate('2026-09-27')).toBe(true);
    expect(isValidEnrolledDate('2026-02-30')).toBe(false);
    expect(isValidEnrolledDate('2026-9-1')).toBe(false);
    expect(isValidEnrolledDate(undefined)).toBe(false);
  });
});
