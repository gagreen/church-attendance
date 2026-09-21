import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it('허용: 사이트 내부 절대 경로(쿼리 포함)', () => {
    expect(safeNextPath('/attendance')).toBe('/attendance');
    expect(safeNextPath('/attendance?date=2026-09-20&class=a')).toBe(
      '/attendance?date=2026-09-20&class=a'
    );
  });

  it('값이 없거나 문자열이 아니면 기본 경로', () => {
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(['/a', '/b'])).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  it('차단: 외부 URL · 프로토콜 상대 URL · 백슬래시 우회', () => {
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
    expect(safeNextPath('attendance')).toBe('/');
  });

  it('차단: 제어 문자 포함', () => {
    expect(safeNextPath('/a\r\nSet-Cookie: x=1')).toBe('/');
    expect(safeNextPath('/a\u0000b')).toBe('/');
  });
});
