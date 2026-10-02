import { describe, expect, it } from 'vitest';
import { parseClassReviewParams, parseWeeklyOverviewParams } from './weeklyReviewParams';

const UUID = '22222222-2222-2222-2222-222222222201';

describe('parseClassReviewParams', () => {
  it('uuid 반 id와 YYYY-MM-DD 날짜를 통과시킨다(요일 무관)', () => {
    expect(parseClassReviewParams(UUID, '2026-09-30')).toEqual({ classId: UUID, date: '2026-09-30' });
  });

  it('형식이 어긋난 값은 null', () => {
    expect(parseClassReviewParams('all', '2026-09-30')).toBeNull(); // 총평은 반 하나 선택 시에만
    expect(parseClassReviewParams('abc', '2026-09-30')).toBeNull();
    expect(parseClassReviewParams(UUID, '2026-13-01')).toBeNull();
    expect(parseClassReviewParams(null, '2026-09-30')).toBeNull();
    expect(parseClassReviewParams(UUID, undefined)).toBeNull();
  });
});

describe('parseWeeklyOverviewParams', () => {
  it("'all' 또는 uuid와 일요일 날짜를 통과시킨다", () => {
    expect(parseWeeklyOverviewParams('all', '2026-09-27')).toEqual({ classId: 'all', weekStart: '2026-09-27' });
    expect(parseWeeklyOverviewParams(UUID, '2026-09-27')).toEqual({ classId: UUID, weekStart: '2026-09-27' });
  });

  it('일요일이 아니거나 형식이 어긋나면 null', () => {
    expect(parseWeeklyOverviewParams('all', '2026-09-28')).toBeNull(); // 월요일
    expect(parseWeeklyOverviewParams('abc', '2026-09-27')).toBeNull();
    expect(parseWeeklyOverviewParams('all', '2026-13-01')).toBeNull();
    expect(parseWeeklyOverviewParams(null, '2026-09-27')).toBeNull();
    expect(parseWeeklyOverviewParams('all', undefined)).toBeNull();
  });
});
