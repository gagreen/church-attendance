// 반/날짜 마지막 선택값 기억(브라우저 localStorage 전용 UI 편의 — 서버/DB에는 저장하지 않는다).
// docs/screens/attendance-input.md "기본값 결정 & 기억" 참고.

const STORAGE_KEY = 'attendance-context';

export type AttendanceTab = 'student' | 'teacher';

export type StoredAttendanceContext = { classId: string; date: string; tab: AttendanceTab };

export function loadStoredContext(): StoredAttendanceContext | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.classId !== 'string' || typeof parsed?.date !== 'string') return null;
    // 교사 탭이 생기기 전에 저장된 값에는 tab이 없다 — 학생 탭으로 간주한다.
    return { classId: parsed.classId, date: parsed.date, tab: parsed.tab === 'teacher' ? 'teacher' : 'student' };
  } catch {
    // 프라이빗 모드 등으로 접근이 막혀도 화면은 서버 기본값으로 정상 동작해야 한다.
    return null;
  }
}

export function saveStoredContext(context: StoredAttendanceContext): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // 저장 실패해도 화면 동작에는 영향 없음(다음 방문 시 서버 기본값으로 재계산).
  }
}
