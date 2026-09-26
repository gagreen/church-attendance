'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { toFailure, type SaveResult } from '@/lib/actionResult';
import {
  createTeacherInvite,
  deleteTeacherInvite,
  updateTeacherRow,
  type TeacherRole,
} from '@/lib/db/teachers';
import { updateAppSettings } from '@/lib/db/settings';
import {
  isTeacherRole,
  isUuid,
  isValidEmail,
  normalizeClassIds,
  normalizeEmail,
  normalizeName,
} from '@/lib/masterValidation';

export type { SaveResult } from '@/lib/actionResult';

const SETTINGS_PATH = '/settings';

export type InviteTeacherParams = {
  email: string;
  name: string;
  role: TeacherRole;
  classIds: string[];
};

// 신규 교사 초대. teachers.id는 auth.users를 참조하므로 로그인 전에는 teachers 행을 만들 수 없어,
// 초대 대기열에 넣어 두고 첫 로그인 때 claim_teacher_invite()가 teachers로 옮긴다.
export async function inviteTeacher(params: InviteTeacherParams): Promise<SaveResult> {
  const admin = await requireAdmin();

  const email = normalizeEmail(String(params.email ?? ''));
  if (!isValidEmail(email)) return { ok: false, error: '이메일 형식이 올바르지 않습니다.' };
  const name = normalizeName(params.name);
  if (!name) return { ok: false, error: '이름을 입력해 주세요. (50자 이내)' };
  if (!isTeacherRole(params.role)) return { ok: false, error: '역할을 선택해 주세요.' };
  const classIds = normalizeClassIds(params.classIds);
  if (!classIds) return { ok: false, error: '담당 반 값이 올바르지 않습니다.' };

  try {
    await createTeacherInvite({
      email,
      name,
      role: params.role,
      // 담당 반은 교사 역할에만 의미가 있다(관리자는 전체 접근, 목사님은 조회 전용).
      classIds: params.role === 'teacher' ? classIds : [],
      invitedBy: admin.id,
    });
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (e) {
    return toFailure('교사 초대 실패', e, '초대에 실패했습니다. 다시 시도해 주세요.');
  }
}

export type CancelInviteParams = { inviteId: string };

export async function cancelInvite(params: CancelInviteParams): Promise<SaveResult> {
  await requireAdmin();
  if (!isUuid(params.inviteId)) return { ok: false, error: '잘못된 요청입니다.' };

  try {
    await deleteTeacherInvite(params.inviteId);
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (e) {
    return toFailure('초대 취소 실패', e, '초대 취소에 실패했습니다. 다시 시도해 주세요.');
  }
}

export type UpdateTeacherParams = {
  teacherId: string;
  isActive?: boolean;
  role?: TeacherRole;
  classIds?: string[];
};

// 마지막 활성 관리자를 비활성화하거나 강등하는 요청은 DB 트리거(teachers_guard_last_admin)가 막는다.
export async function updateTeacher(params: UpdateTeacherParams): Promise<SaveResult> {
  await requireAdmin();

  if (!isUuid(params.teacherId)) return { ok: false, error: '잘못된 요청입니다.' };
  if (params.isActive !== undefined && typeof params.isActive !== 'boolean') {
    return { ok: false, error: '잘못된 요청입니다.' };
  }
  if (params.role !== undefined && !isTeacherRole(params.role)) {
    return { ok: false, error: '역할 값이 올바르지 않습니다.' };
  }
  let classIds: string[] | undefined;
  if (params.classIds !== undefined) {
    const normalized = normalizeClassIds(params.classIds);
    if (!normalized) return { ok: false, error: '담당 반 값이 올바르지 않습니다.' };
    classIds = normalized;
  }

  try {
    await updateTeacherRow({ teacherId: params.teacherId, isActive: params.isActive, role: params.role, classIds });
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (e) {
    return toFailure('교사 수정 실패', e, '저장에 실패했습니다. 다시 시도해 주세요.');
  }
}

export type SetTeachersCanViewAllParams = { value: boolean };

export async function setTeachersCanViewAll(params: SetTeachersCanViewAllParams): Promise<SaveResult> {
  const admin = await requireAdmin();
  if (typeof params.value !== 'boolean') return { ok: false, error: '잘못된 요청입니다.' };

  try {
    await updateAppSettings({ teachersCanViewAll: params.value }, admin.id);
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (e) {
    return toFailure('교사 전체보기 설정 실패', e, '설정을 저장하지 못했습니다. 다시 시도해 주세요.');
  }
}

export type SetShowLateButtonParams = { value: boolean };

// 표시 전용 설정이다 — 출석 저장(saveAttendanceStatus)은 이 값과 무관하게 `지각`을 막지 않는다.
// 출석 입력·학생 상세 화면이 새 값을 읽도록 그 화면들도 함께 무효화한다.
export async function setShowLateButton(params: SetShowLateButtonParams): Promise<SaveResult> {
  const admin = await requireAdmin();
  if (typeof params.value !== 'boolean') return { ok: false, error: '잘못된 요청입니다.' };

  try {
    await updateAppSettings({ showLateButton: params.value }, admin.id);
    revalidatePath(SETTINGS_PATH);
    revalidatePath('/');
    revalidatePath('/students/[id]', 'page');
    return { ok: true };
  } catch (e) {
    return toFailure('지각 버튼 설정 실패', e, '설정을 저장하지 못했습니다. 다시 시도해 주세요.');
  }
}
