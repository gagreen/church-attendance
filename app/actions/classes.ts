'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { toFailure, type SaveResult } from '@/lib/actionResult';
import { insertClass, updateClassRow } from '@/lib/db/classes';
import { isUuid, normalizeName } from '@/lib/masterValidation';

export type { SaveResult } from '@/lib/actionResult';

export type CreateClassParams = { name: string };

export async function createClass(params: CreateClassParams): Promise<SaveResult> {
  await requireAdmin();
  const name = normalizeName(params.name);
  if (!name) return { ok: false, error: '반 이름을 입력해 주세요. (50자 이내)' };

  try {
    await insertClass(name);
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return toFailure('반 등록 실패', e, '등록에 실패했습니다. 다시 시도해 주세요.');
  }
}

export type UpdateClassParams = { classId: string; name?: string; isActive?: boolean };

// 비활성화(soft delete)는 배정된 학생·출석 기록을 그대로 두고 반 선택 드롭다운에서만 숨긴다.
export async function updateClass(params: UpdateClassParams): Promise<SaveResult> {
  await requireAdmin();
  if (!isUuid(params.classId)) return { ok: false, error: '잘못된 요청입니다.' };
  if (params.isActive !== undefined && typeof params.isActive !== 'boolean') {
    return { ok: false, error: '잘못된 요청입니다.' };
  }
  let name: string | undefined;
  if (params.name !== undefined) {
    const normalized = normalizeName(params.name);
    if (!normalized) return { ok: false, error: '반 이름을 입력해 주세요. (50자 이내)' };
    name = normalized;
  }

  try {
    await updateClassRow({ classId: params.classId, name, isActive: params.isActive });
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return toFailure('반 수정 실패', e, '저장에 실패했습니다. 다시 시도해 주세요.');
  }
}
