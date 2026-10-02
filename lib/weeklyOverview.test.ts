import { describe, expect, it } from 'vitest';
import { buildWeeklyOverview, EMPTY_CLASS_REVIEW, type WeeklyAttendanceRow } from './weeklyOverview';

const classes = [
  { classId: 'c1', className: '중등부' },
  { classId: 'c2', className: '초등2부' },
];

function row(overrides: Partial<WeeklyAttendanceRow>): WeeklyAttendanceRow {
  return {
    classId: 'c1',
    studentId: 's1',
    studentName: '김학생',
    grade: '중1',
    date: '2026-09-27',
    status: '출석',
    comment: null,
    ...overrides,
  };
}

describe('buildWeeklyOverview', () => {
  it('상태별 숫자를 반별로 집계하고, 기록 없는 반은 0으로 채운다', () => {
    const overview = buildWeeklyOverview({
      weekStart: '2026-09-27',
      classes,
      activeStudentCounts: new Map([['c1', 5], ['c2', 3]]),
      attendanceRows: [row({ status: '출석' }), row({ studentId: 's2', status: '지각' })],
      reviews: new Map(),
    });

    const c1 = overview.cards.find((c) => c.classId === 'c1')!;
    const c2 = overview.cards.find((c) => c.classId === 'c2')!;
    expect(c1.counts).toEqual({ 출석: 1, 지각: 1, 결석: 0, 공예배: 0 });
    expect(c1.recordedStudents).toBe(2);
    expect(c1.activeStudents).toBe(5);
    expect(c2.counts).toEqual({ 출석: 0, 지각: 0, 결석: 0, 공예배: 0 });
    expect(c2.review).toEqual(EMPTY_CLASS_REVIEW);
  });

  it('같은 학생이 같은 상태로 여러 번 기록돼도 이름은 한 번만 나온다(카운트는 그대로 센다)', () => {
    const overview = buildWeeklyOverview({
      weekStart: '2026-09-27',
      classes,
      activeStudentCounts: new Map(),
      attendanceRows: [
        row({ status: '결석', date: '2026-09-27' }),
        row({ status: '결석', date: '2026-09-30' }), // 평일 보충 입력
      ],
      reviews: new Map(),
    });

    const c1 = overview.cards.find((c) => c.classId === 'c1')!;
    expect(c1.counts.결석).toBe(2);
    expect(c1.absentNames).toEqual(['김학생']);
  });

  it('결석·지각자 이름은 학년 내림차순 → 이름순으로 정렬된다', () => {
    const overview = buildWeeklyOverview({
      weekStart: '2026-09-27',
      classes,
      activeStudentCounts: new Map(),
      attendanceRows: [
        row({ studentId: 's1', studentName: '김중1', grade: '중1', status: '결석' }),
        row({ studentId: 's2', studentName: '박고3', grade: '고3', status: '결석' }),
        row({ studentId: 's3', studentName: '이중1', grade: '중1', status: '결석' }),
      ],
      reviews: new Map(),
    });

    const c1 = overview.cards.find((c) => c.classId === 'c1')!;
    expect(c1.absentNames).toEqual(['박고3', '김중1', '이중1']);
  });

  it('코멘트가 있는 기록만 날짜 오름차순으로 모은다', () => {
    const overview = buildWeeklyOverview({
      weekStart: '2026-09-27',
      classes,
      activeStudentCounts: new Map(),
      attendanceRows: [
        row({ status: '지각', comment: '병원 진료로 늦음', date: '2026-09-27' }),
        row({ studentId: 's2', status: '출석', comment: null }),
        row({ studentId: 's3', status: '결석', comment: '가족 여행', date: '2026-09-24' }),
      ],
      reviews: new Map(),
    });

    const c1 = overview.cards.find((c) => c.classId === 'c1')!;
    expect(c1.comments).toEqual([
      { studentName: '김학생', status: '결석', date: '2026-09-24', comment: '가족 여행' },
      { studentName: '김학생', status: '지각', date: '2026-09-27', comment: '병원 진료로 늦음' },
    ]);
  });

  it('저장된 총평이 있으면 그대로 붙인다', () => {
    const review = {
      reviewId: 'r1',
      body: '공과: 로마서 8장',
      lastModifiedByName: '박교사',
      lastModifiedAt: '2026-09-28T02:20:00Z',
      replies: [],
    };
    const overview = buildWeeklyOverview({
      weekStart: '2026-09-27',
      classes,
      activeStudentCounts: new Map(),
      attendanceRows: [],
      reviews: new Map([['c1', review]]),
    });

    expect(overview.cards.find((c) => c.classId === 'c1')!.review).toEqual(review);
  });
});
