'use server';

import { requireAdmin } from '@/lib/auth';
import { listClassesForAdmin, type ClassAdminRow } from '@/lib/db/classes';
import { getAppSettings, type AppSettings } from '@/lib/db/settings';
import { listStudentsForAdmin, type StudentAdminRow } from '@/lib/db/students';
import {
  listInvitesForAdmin,
  listTeachersForAdmin,
  type TeacherAdminRow,
  type TeacherInviteRow,
} from '@/lib/db/teachers';

export type { AppSettings } from '@/lib/db/settings';
export type { ClassAdminRow } from '@/lib/db/classes';
export type { StudentAdminRow } from '@/lib/db/students';
export type { TeacherAdminRow, TeacherInviteRow, TeacherRole } from '@/lib/db/teachers';

export type MasterManagementData = {
  currentTeacherId: string; // 본인 행에 대한 경고(자기 자신 비활성화 등)에 쓴다
  teachers: TeacherAdminRow[];
  invites: TeacherInviteRow[];
  students: StudentAdminRow[];
  classes: ClassAdminRow[];
  settings: AppSettings;
};

// 마스터 관리 화면이 한 번에 쓰는 전체 데이터. 규모가 작아(반 6·학생 20·교사 6~8) 탭별로 나누지 않고
// 모두 내려주며, 각 등록/수정 액션이 revalidatePath('/settings')로 이 데이터를 다시 받아오게 한다.
export async function getMasterManagementData(): Promise<MasterManagementData> {
  const admin = await requireAdmin();

  const [teachers, invites, students, classes, settings] = await Promise.all([
    listTeachersForAdmin(),
    listInvitesForAdmin(),
    listStudentsForAdmin(),
    listClassesForAdmin(),
    getAppSettings(),
  ]);

  return { currentTeacherId: admin.id, teachers, invites, students, classes, settings };
}
