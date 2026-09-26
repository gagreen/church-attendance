// 학년 상수·타입. Supabase 서버 클라이언트에 의존하지 않아 클라이언트 컴포넌트(입력 폼)에서도 import할 수 있다.
export type Grade = '고3' | '고2' | '고1' | '중3' | '중2' | '중1';

// 학년 선택지(입력 폼용, 낮은 학년 → 높은 학년). DB check 제약(중1~고3)과 같은 목록이다.
export const GRADE_OPTIONS: readonly Grade[] = ['중1', '중2', '중3', '고1', '고2', '고3'];

export function isGrade(value: string): value is Grade {
  return (GRADE_OPTIONS as readonly string[]).includes(value);
}
