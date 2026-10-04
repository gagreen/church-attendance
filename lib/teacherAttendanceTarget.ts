// 교사 출석의 대상 식별자. 활성 교사(teacherId)와 가입 전 교사 초대(inviteId)는 teacher_attendance에서 서로
// 다른 컬럼으로 구분된다(0010 마이그레이션). 이 파일은 서버 의존이 없어 클라이언트 컴포넌트에서도 import한다.

export type TeacherTarget = { teacherId: string } | { inviteId: string };

// 화면 행 key, 저장 대기 버퍼 id로 쓴다. 활성 교사와 초대 id는 uuid라 실제로 겹치지 않지만, 종류를 함께 남긴다.
export function targetKey(target: TeacherTarget): string {
  return 'teacherId' in target ? `t:${target.teacherId}` : `i:${target.inviteId}`;
}

// 명단 항목(list_attendance_teachers)의 id와 is_pending으로 대상 식별자를 만든다.
export function targetOf(id: string, isPending: boolean): TeacherTarget {
  return isPending ? { inviteId: id } : { teacherId: id };
}
