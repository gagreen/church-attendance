import { describe, expect, it } from 'vitest';
import { mergeTeacherAttendance, type AttendanceTeacher } from './teacherAttendance';

const teachers: AttendanceTeacher[] = [
  { id: 't1', name: '김선생', classNames: ['중등부', '초등2부'], isPending: false },
  { id: 'i1', name: '가입전', classNames: ['유치부'], isPending: true },
  { id: 't2', name: '박선생', classNames: [], isPending: false },
];

describe('mergeTeacherAttendance', () => {
  it('기록이 있는 교사는 상태·코멘트를 붙이고 없으면 미체크(null)로 둔다', () => {
    const rows = mergeTeacherAttendance(teachers, [
      { target: { teacherId: 't1' }, status: '지각', comment: '차가 막힘' },
    ]);
    expect(rows[0]).toEqual({
      key: 't:t1',
      target: { teacherId: 't1' },
      teacherName: '김선생',
      classNames: ['중등부', '초등2부'],
      isPending: false,
      status: '지각',
      comment: '차가 막힘',
    });
    expect(rows[2].status).toBeNull();
  });

  it('가입 전 교사는 inviteId 대상으로 병합되고 isPending이 true다', () => {
    const rows = mergeTeacherAttendance(teachers, [{ target: { inviteId: 'i1' }, status: '출석', comment: null }]);
    expect(rows[1]).toMatchObject({ key: 'i:i1', target: { inviteId: 'i1' }, isPending: true, status: '출석' });
  });

  it('같은 id라도 활성 교사 기록과 초대 기록은 섞이지 않는다', () => {
    const rows = mergeTeacherAttendance(
      [{ id: 'x', name: '가', classNames: [], isPending: true }],
      [{ target: { teacherId: 'x' }, status: '결석', comment: null }]
    );
    expect(rows[0].status).toBeNull();
  });

  it('명단 순서를 유지하고 명단에 없는 대상의 기록은 무시한다', () => {
    const rows = mergeTeacherAttendance(teachers, [
      { target: { teacherId: 'gone' }, status: '출석', comment: null },
      { target: { teacherId: 't2' }, status: '결석', comment: null },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['t:t1', 'i:i1', 't:t2']);
    expect(rows[2].status).toBe('결석');
  });
});
