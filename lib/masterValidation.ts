// 마스터 관리 화면(Server Action) 공용 입력 검증. 클라이언트에서 온 값은 신뢰하지 않으므로 서버에서도 항상 다시 검사한다.
import { isValidDate } from '@/lib/date';
import { isGrade, type Grade } from '@/lib/gradeOptions';
import type { TeacherRole } from '@/lib/db/teachers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 완벽한 RFC 검증이 아니라 "명백한 오타"만 거른다(공백 없음, @ 하나, 도메인에 점). 진짜 검증은 구글 로그인이 한다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_MAX_LENGTH = 50;
const ROLES: readonly TeacherRole[] = ['admin', 'teacher', 'pastor'];

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// 구글 로그인 이메일은 소문자로 내려오므로 저장·비교 모두 소문자로 통일한다.
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

// 이름 공통 규칙: 앞뒤 공백 제거, 비어 있으면 안 됨, 길이 제한. 통과하면 정리된 이름, 아니면 null.
export function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > NAME_MAX_LENGTH) return null;
  return trimmed;
}

export function isTeacherRole(value: unknown): value is TeacherRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// classIds 입력 검증 + 중복 제거. UUID가 아닌 값이 하나라도 있으면 null.
export function normalizeClassIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isUuid)) return null;
  return [...new Set(value)];
}

// grade는 "미지정"(undefined/null/빈 문자열)과 "잘못된 값"을 구분해야 한다.
// 반환: { ok: true, grade } (grade는 null 가능) 또는 { ok: false }.
export function parseGrade(value: unknown): { ok: true; grade: Grade | null } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true, grade: null };
  if (typeof value === 'string' && isGrade(value)) return { ok: true, grade: value };
  return { ok: false };
}

export function isValidEnrolledDate(value: unknown): value is string {
  return typeof value === 'string' && isValidDate(value);
}
