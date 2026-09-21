import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/database.types';

export type Teacher = Pick<Tables<'teachers'>, 'id' | 'email' | 'name' | 'role'>;

// 로그인 사용자 본인의 활성 교사 행을 조회한다. 화이트리스트에 없거나 비활성이면 null.
// RLS(teachers_select_self)가 본인 행 조회를 허용하므로 anon 키 + 사용자 세션으로 충분하다.
export async function findActiveTeacherById(id: string): Promise<Teacher | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('id, email, name, role')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  // "행 없음"(null)과 "조회 실패"를 구분한다 — DB 장애를 "권한 없음"으로 오인하지 않도록 던진다.
  if (error) throw new Error(`teachers 조회 실패: ${error.message}`);
  return data;
}
