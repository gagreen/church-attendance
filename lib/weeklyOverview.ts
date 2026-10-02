// 주별 모아보기(통계 화면) 집계 순수 함수. DB I/O는 lib/db/weeklyReview.ts가 담당하고, 여기서는 이미 조회된
// 원본 행(그 주 attendance + 반별 총평)을 화면이 쓰는 모양으로 정리만 한다 — docs/screens/weekly-review.md.
// 반 6·학생 20 규모라 Postgres 함수 없이 한 번에 불러 여기서 집계해도 부담이 없다(같은 문서).

import { sortStudents } from '@/lib/db/students';
import type { AttendanceStatus } from '@/lib/db/attendance';

export type ReviewReply = { id: string; body: string; authorName: string; createdAt: string; mine: boolean };

export type ClassReview = {
  reviewId: string | null; // 아직 한 번도 저장 안 했으면 null
  body: string;
  lastModifiedByName: string | null;
  lastModifiedAt: string | null;
  replies: ReviewReply[];
};

// 저장된 적 없는 반의 기본값(빈 총평·답글 없음). getClassReview/getWeeklyOverview가 공유한다.
export const EMPTY_CLASS_REVIEW: ClassReview = {
  reviewId: null,
  body: '',
  lastModifiedByName: null,
  lastModifiedAt: null,
  replies: [],
};

export type WeeklyAttendanceRow = {
  classId: string; // 기록 당시 반(attendance.class_id) — 반 이동 처리 원칙과 동일
  studentId: string;
  studentName: string;
  grade: string | null;
  date: string;
  status: AttendanceStatus;
  comment: string | null;
};

export type WeeklyClassCard = {
  classId: string;
  className: string;
  recordedStudents: number; // 그 주에 저장된 attendance 행 수(중복 입력이 있으면 그대로 카운트)
  activeStudents: number; // 현재 활성 학생 수
  counts: { 출석: number; 지각: number; 결석: number; 공예배: number };
  absentNames: string[]; // 학년 내림차순 → 이름순, 학생당 1회만
  lateNames: string[];
  comments: { studentName: string; status: AttendanceStatus; date: string; comment: string }[];
  review: ClassReview;
};

export type WeeklyOverview = { weekStart: string; cards: WeeklyClassCard[] };

export function buildWeeklyOverview(params: {
  weekStart: string;
  classes: { classId: string; className: string }[]; // 이미 접근 가능·이름순으로 필터된 반 목록
  activeStudentCounts: Map<string, number>; // classId -> 현재 활성 학생 수
  attendanceRows: WeeklyAttendanceRow[]; // 그 주(일~토) 범위의 attendance 원본 행 전체
  reviews: Map<string, ClassReview>; // classId -> 총평(없는 반은 생략 가능 — EMPTY_CLASS_REVIEW로 채움)
}): WeeklyOverview {
  const rowsByClass = new Map<string, WeeklyAttendanceRow[]>();
  for (const row of params.attendanceRows) {
    rowsByClass.set(row.classId, [...(rowsByClass.get(row.classId) ?? []), row]);
  }

  const cards = params.classes.map((c) => {
    const rows = rowsByClass.get(c.classId) ?? [];

    const counts = { 출석: 0, 지각: 0, 결석: 0, 공예배: 0 };
    for (const r of rows) counts[r.status] += 1;

    // 결석/지각 이름 목록은 학생당 1회만(같은 주에 같은 상태로 두 번 기록돼도 이름은 중복 표시하지 않는다).
    function uniqueNamesByStatus(status: AttendanceStatus): string[] {
      const byStudent = new Map<string, { grade: string | null; name: string }>();
      for (const r of rows) {
        if (r.status === status && !byStudent.has(r.studentId)) {
          byStudent.set(r.studentId, { grade: r.grade, name: r.studentName });
        }
      }
      return sortStudents([...byStudent.values()]).map((s) => s.name);
    }

    const comments = rows
      .filter((r): r is WeeklyAttendanceRow & { comment: string } => !!r.comment)
      .map((r) => ({ studentName: r.studentName, status: r.status, date: r.date, comment: r.comment }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.studentName.localeCompare(b.studentName, 'ko'));

    return {
      classId: c.classId,
      className: c.className,
      recordedStudents: rows.length,
      activeStudents: params.activeStudentCounts.get(c.classId) ?? 0,
      counts,
      absentNames: uniqueNamesByStatus('결석'),
      lateNames: uniqueNamesByStatus('지각'),
      comments,
      review: params.reviews.get(c.classId) ?? EMPTY_CLASS_REVIEW,
    };
  });

  return { weekStart: params.weekStart, cards };
}
