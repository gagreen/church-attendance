// 화면에 그대로 보여줘도 되는 메시지를 가진 오류. lib/db 헬퍼가 알려진 제약 위반(유니크 등)을 이 오류로
// 변환해서 던지면, Server Action은 이 메시지만 사용자에게 내려주고 그 외 오류는 일반 메시지로 가린다
// (원본 Postgres 오류 노출 금지 — docs/screens/master-management.md).
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

type PostgrestErrorLike = { code?: string; message: string; details?: string | null };

// Postgres unique_violation. 어떤 제약인지는 message/details에 제약(인덱스) 이름이 들어 있어 구분한다.
export function isUniqueViolation(error: PostgrestErrorLike): boolean {
  return error.code === '23505';
}

export function mentionsConstraint(error: PostgrestErrorLike, name: string): boolean {
  return `${error.message} ${error.details ?? ''}`.includes(name);
}

// RLS로 쓰기 권한이 없는 행은 에러 없이 0건 갱신으로 끝난다(students.ts의 deleteStudentNote와 같은 문제).
// `.select()`로 돌려받은 행이 없으면 "조용한 실패"이므로 실패로 취급한다.
export function assertAffected(rows: unknown[] | null, what: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(`${what} 실패: 변경된 행이 없습니다(권한 없음 또는 대상 없음)`);
  }
}
