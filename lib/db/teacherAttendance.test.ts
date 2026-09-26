import { describe, expect, it } from 'vitest';
import { mergeTeacherAttendance } from './teacherAttendance';

const teachers = [
  { id: 't1', name: '김선생', classNames: ['중등부', '초등2부'] },
  { id: 't2', name: '박선생', classNames: [] },
];

describe('mergeTeacherAttendance', () => {
  it('기록이 있는 교사는 상태·코멘트를 붙이고 없으면 미체크(null)로 둔다', () => {
    const rows = mergeTeacherAttendance(teachers, [{ teacherId: 't1', status: '지각', comment: '차가 막힘' }]);
    expect(rows).toEqual([
      { teacherId: 't1', teacherName: '김선생', classNames: ['중등부', '초등2부'], status: '지각', comment: '차가 막힘' },
      { teacherId: 't2', teacherName: '박선생', classNames: [], status: null, comment: null },
    ]);
  });

  it('명단 순서를 유지하고 명단에 없는 교사의 기록은 무시한다', () => {
    const rows = mergeTeacherAttendance(teachers, [
      { teacherId: 'gone', status: '출석', comment: null },
      { teacherId: 't2', status: '결석', comment: null },
    ]);
    expect(rows.map((r) => r.teacherId)).toEqual(['t1', 't2']);
    expect(rows[1].status).toBe('결석');
  });
});
