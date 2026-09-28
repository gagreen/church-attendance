// 날짜 계산 순수 함수 모음. 서버(Vercel, 기본 UTC)와 클라이언트 모두에서 "일요일이 주의 시작"이라는
// 전제로 동작해야 하므로, 오늘 날짜는 항상 KST 기준으로 구한다(todayInKST). 날짜는 전부 'YYYY-MM-DD' 문자열로
// 다루고, 요일 계산은 UTC epoch 기준 Date로 통일해 로컬 타임존에 따라 날짜가 밀리는 문제를 피한다.

const KST_TIME_ZONE = 'Asia/Seoul';
const WEEKDAY_LABELS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function toUtcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayInKST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST_TIME_ZONE }).format(new Date());
}

export function sundayOfWeek(dateStr: string): string {
  const date = toUtcDate(dateStr);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return toDateStr(date);
}

export function thisWeekSundayInKST(): string {
  return sundayOfWeek(todayInKST());
}

export function addDays(dateStr: string, days: number): string {
  const date = toUtcDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateStr(date);
}

// 이전(-1)/다음(1) 일요일. 일요일이면 7일 전/후, 주중이면 직전/직후 일요일로 이동한다(자기 자신은 포함하지 않음).
export function adjacentSunday(dateStr: string, direction: -1 | 1): string {
  const sunday = sundayOfWeek(dateStr);
  if (direction === -1) return addDays(sunday, sunday === dateStr ? -7 : 0);
  return addDays(sunday, 7);
}

// 'YYYY-MM-DD' 형식이면서 실제로 존재하는 날짜인지(예: 2026-02-30은 false).
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateStr(toUtcDate(value)) === value;
}

export function isSunday(dateStr: string): boolean {
  return toUtcDate(dateStr).getUTCDay() === 0;
}

export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}(${WEEKDAY_LABELS_KO[toUtcDate(dateStr).getUTCDay()]})`;
}

// 'YYYY-MM-DD' 또는 timestamptz ISO 문자열('YYYY-MM-DDTHH:mm:ss...') 앞부분만 'YYYY.MM.DD'로 표기한다.
// student_notes.created_at처럼 요일 표기가 필요 없는 날짜 표시용.
export function formatDateDotted(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${y}.${m}.${d}`;
}

// 캘린더 그리드용 날짜 목록(6주 x 7일 = 42칸, 앞뒤 달 날짜로 채움). month는 1~12.
export function calendarMonthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstOfMonth.getUTCDay());

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return { date: toDateStr(d), inMonth: d.getUTCMonth() === month - 1 };
  });
}

// 월은 'YYYY-MM' 문자열로 다룬다(통계 화면의 월 선택값).
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function currentMonthInKST(): string {
  return todayInKST().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return toDateStr(date).slice(0, 7);
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}
