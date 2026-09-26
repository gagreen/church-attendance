import { UserFacingError } from '@/lib/db/errors';

export type SaveResult = { ok: true } | { ok: false; error: string };

// Server Action의 catch 블록 공용 변환. 사용자에게 보여도 되는 오류(UserFacingError)만 메시지를 그대로 내려주고,
// 그 외(원본 Postgres 오류 등)는 서버 로그에만 남기고 일반 메시지로 가린다.
export function toFailure(context: string, e: unknown, fallback: string): { ok: false; error: string } {
  if (e instanceof UserFacingError) return { ok: false, error: e.message };
  console.error(`${context}:`, e);
  return { ok: false, error: fallback };
}
