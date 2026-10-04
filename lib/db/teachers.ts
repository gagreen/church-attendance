import { createClient } from '@/lib/supabase/server';
import type { Tables, TablesUpdate } from '@/lib/database.types';
import { UserFacingError, assertAffected, isUniqueViolation } from '@/lib/db/errors';

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

// ---------------------------------------------------------------------------------------------
// 마스터 관리(관리자 전용) — docs/screens/master-management.md
// ---------------------------------------------------------------------------------------------

export type TeacherRole = 'admin' | 'teacher' | 'pastor';

export type TeacherAdminRow = {
  id: string;
  email: string;
  name: string;
  role: TeacherRole;
  isActive: boolean;
  classIds: string[]; // teacher_classes 매핑. 역할과 무관하게 저장돼 있으며, 화면은 role === 'teacher'일 때만 보여준다.
};

export type TeacherInviteRow = {
  id: string;
  email: string;
  name: string;
  role: TeacherRole;
  classIds: string[];
  attendanceCount: number; // 취소하면 함께 삭제되는 가입 전 출석 기록 수(teacher_attendance.invite_id)
};

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K, value: (row: T) => string): Map<K, string[]> {
  const map = new Map<K, string[]>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, [...(map.get(k) ?? []), value(row)]);
  }
  return map;
}

// 활성·비활성 교사 전체(관리자 RLS: teachers_select_self가 is_admin()이면 전체 조회 허용). 이름 가나다순.
export async function listTeachersForAdmin(): Promise<TeacherAdminRow[]> {
  const supabase = await createClient();

  const [{ data: teachers, error }, { data: mappings, error: mappingsError }] = await Promise.all([
    supabase.from('teachers').select('id, email, name, role, is_active'),
    supabase.from('teacher_classes').select('teacher_id, class_id'),
  ]);
  if (error) throw new Error(`teachers 조회 실패: ${error.message}`);
  if (mappingsError) throw new Error(`teacher_classes 조회 실패: ${mappingsError.message}`);

  const classIdsByTeacher = groupBy(mappings ?? [], (m) => m.teacher_id, (m) => m.class_id);

  return (teachers ?? [])
    .map((t) => ({
      id: t.id,
      email: t.email,
      name: t.name,
      role: t.role as TeacherRole,
      isActive: t.is_active,
      classIds: classIdsByTeacher.get(t.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

// 아직 로그인하지 않은 초대 대기열. 오래된 초대가 위로 온다.
export async function listInvitesForAdmin(): Promise<TeacherInviteRow[]> {
  const supabase = await createClient();

  const [{ data: invites, error }, { data: mappings, error: mappingsError }, { data: records, error: recordsError }] =
    await Promise.all([
      supabase.from('teacher_invites').select('id, email, name, role').order('invited_at', { ascending: true }),
      supabase.from('teacher_invite_classes').select('invite_id, class_id'),
      supabase.from('teacher_attendance').select('invite_id').not('invite_id', 'is', null),
    ]);
  if (error) throw new Error(`teacher_invites 조회 실패: ${error.message}`);
  if (mappingsError) throw new Error(`teacher_invite_classes 조회 실패: ${mappingsError.message}`);
  if (recordsError) throw new Error(`teacher_attendance 조회 실패: ${recordsError.message}`);

  const classIdsByInvite = groupBy(mappings ?? [], (m) => m.invite_id, (m) => m.class_id);
  const recordCountByInvite = new Map<string, number>();
  for (const r of records ?? []) {
    if (r.invite_id) recordCountByInvite.set(r.invite_id, (recordCountByInvite.get(r.invite_id) ?? 0) + 1);
  }

  return (invites ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    name: i.name,
    role: i.role as TeacherRole,
    classIds: classIdsByInvite.get(i.id) ?? [],
    attendanceCount: recordCountByInvite.get(i.id) ?? 0,
  }));
}

type CreateInviteParams = {
  email: string; // 호출부에서 trim + 소문자로 정규화해서 넘긴다
  name: string;
  role: TeacherRole;
  classIds: string[];
  invitedBy: string;
};

// teacher_invites + teacher_invite_classes 두 테이블에 쓴다. supabase-js에는 트랜잭션이 없으므로,
// 담당 반 저장이 실패하면 방금 만든 초대를 지워 "반 없는 초대"가 남지 않게 한다.
export async function createTeacherInvite(params: CreateInviteParams): Promise<void> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from('teachers')
    .select('id')
    .eq('email', params.email)
    .maybeSingle();
  if (existingError) throw new Error(`teachers 조회 실패: ${existingError.message}`);
  if (existing) throw new UserFacingError('이미 등록된 교사의 이메일입니다.');

  const { data: invite, error } = await supabase
    .from('teacher_invites')
    .insert({ email: params.email, name: params.name, role: params.role, invited_by: params.invitedBy })
    .select('id')
    .single();
  if (error) {
    if (isUniqueViolation(error)) throw new UserFacingError('이미 초대된 이메일입니다.');
    throw new Error(`teacher_invites 저장 실패: ${error.message}`);
  }

  if (params.classIds.length === 0) return;
  const { error: classesError } = await supabase
    .from('teacher_invite_classes')
    .insert(params.classIds.map((classId) => ({ invite_id: invite.id, class_id: classId })));
  if (classesError) {
    await supabase.from('teacher_invites').delete().eq('id', invite.id);
    throw new Error(`teacher_invite_classes 저장 실패: ${classesError.message}`);
  }
}

export async function deleteTeacherInvite(inviteId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('teacher_invites').delete().eq('id', inviteId).select('id');
  if (error) throw new Error(`teacher_invites 삭제 실패: ${error.message}`);
  assertAffected(data, 'teacher_invites 삭제');
}

type UpdateTeacherRowParams = {
  teacherId: string;
  isActive?: boolean;
  role?: TeacherRole;
  classIds?: string[];
};

export async function updateTeacherRow(params: UpdateTeacherRowParams): Promise<void> {
  const supabase = await createClient();

  if (params.isActive !== undefined || params.role !== undefined) {
    const update: TablesUpdate<'teachers'> = {};
    if (params.isActive !== undefined) update.is_active = params.isActive;
    if (params.role !== undefined) update.role = params.role;

    const { data, error } = await supabase.from('teachers').update(update).eq('id', params.teacherId).select('id');
    if (error) {
      // 0007의 teachers_guard_last_admin 트리거가 던지는 오류.
      if (error.message.includes('last_active_admin')) {
        throw new UserFacingError('활성 관리자는 최소 1명이 있어야 합니다.');
      }
      throw new Error(`teachers 수정 실패: ${error.message}`);
    }
    assertAffected(data, 'teachers 수정');
  }

  if (params.classIds !== undefined) await replaceTeacherClasses(params.teacherId, params.classIds);
}

// 담당 반을 통째로 교체한다. 추가를 먼저 하고 제거를 나중에 해서, 중간에 실패해도 담당 반이 "덜 남는"
// 상태가 아니라 "더 남는" 상태가 되게 한다(교사가 갑자기 접근 권한을 잃는 쪽이 더 나쁘다).
async function replaceTeacherClasses(teacherId: string, classIds: string[]): Promise<void> {
  const supabase = await createClient();

  const { data: current, error } = await supabase
    .from('teacher_classes')
    .select('class_id')
    .eq('teacher_id', teacherId);
  if (error) throw new Error(`teacher_classes 조회 실패: ${error.message}`);

  const currentIds = new Set((current ?? []).map((m) => m.class_id));
  const nextIds = new Set(classIds);
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length > 0) {
    const { error: addError } = await supabase
      .from('teacher_classes')
      .insert(toAdd.map((classId) => ({ teacher_id: teacherId, class_id: classId })));
    if (addError) throw new Error(`teacher_classes 추가 실패: ${addError.message}`);
  }
  if (toRemove.length > 0) {
    const { error: removeError } = await supabase
      .from('teacher_classes')
      .delete()
      .eq('teacher_id', teacherId)
      .in('class_id', toRemove);
    if (removeError) throw new Error(`teacher_classes 삭제 실패: ${removeError.message}`);
  }
}
