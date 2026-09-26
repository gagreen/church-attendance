import { describe, expect, it } from 'vitest';
import { parseStatisticsParams } from './statisticsParams';

const UUID = '22222222-2222-2222-2222-222222222201';

describe('parseStatisticsParams', () => {
  it("'all' 또는 uuid와 YYYY-MM을 통과시킨다", () => {
    expect(parseStatisticsParams('all', '2026-09')).toEqual({ classId: 'all', month: '2026-09' });
    expect(parseStatisticsParams(UUID, '2026-09')).toEqual({ classId: UUID, month: '2026-09' });
  });

  it('형식이 어긋난 값은 null', () => {
    expect(parseStatisticsParams('abc', '2026-09')).toBeNull();
    expect(parseStatisticsParams('all', '2026-13')).toBeNull();
    expect(parseStatisticsParams('all', '2026-09-01')).toBeNull();
    expect(parseStatisticsParams(null, '2026-09')).toBeNull();
    expect(parseStatisticsParams('all', undefined)).toBeNull();
  });
});
