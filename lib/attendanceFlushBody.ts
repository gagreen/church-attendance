// app/api/attendance/flush(Route Handler)가 받는 sendBeacon payload의 파싱/검증. 브라우저가 페이지를
// 닫거나 숨길 때 보내는 신뢰할 수 없는 입력이라 Server Action과 달리 타입을 그대로 믿을 수 없다 —
// 여기서 모양이 맞는지 확인한 뒤에만 DB 저장 함수로 넘긴다.

const ATTENDANCE_STATUSES = ['출석', '지각', '결석', '공예배'] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isCommentValue(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export type StudentFlushBody = {
  kind: 'student';
  date: string;
  entries: { studentId: string; classId: string; status: AttendanceStatus; comment: string | null }[];
};

export type TeacherFlushBody = {
  kind: 'teacher';
  date: string;
  entries: { teacherId: string; status: AttendanceStatus; comment: string | null }[];
};

export type AttendanceFlushBody = StudentFlushBody | TeacherFlushBody;

export function parseAttendanceFlushBody(body: unknown): AttendanceFlushBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.date) || !Array.isArray(b.entries)) return null;

  if (b.kind === 'student') {
    const entries: StudentFlushBody['entries'] = [];
    for (const e of b.entries) {
      if (typeof e !== 'object' || e === null) return null;
      const r = e as Record<string, unknown>;
      if (!isNonEmptyString(r.studentId) || !isNonEmptyString(r.classId)) return null;
      if (!isAttendanceStatus(r.status) || !isCommentValue(r.comment)) return null;
      entries.push({ studentId: r.studentId, classId: r.classId, status: r.status, comment: r.comment });
    }
    return { kind: 'student', date: b.date, entries };
  }

  if (b.kind === 'teacher') {
    const entries: TeacherFlushBody['entries'] = [];
    for (const e of b.entries) {
      if (typeof e !== 'object' || e === null) return null;
      const r = e as Record<string, unknown>;
      if (!isNonEmptyString(r.teacherId)) return null;
      if (!isAttendanceStatus(r.status) || !isCommentValue(r.comment)) return null;
      entries.push({ teacherId: r.teacherId, status: r.status, comment: r.comment });
    }
    return { kind: 'teacher', date: b.date, entries };
  }

  return null;
}
