import { createClient } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/database.types';
import { assertAffected } from '@/lib/db/errors';

export type AppSettings = { teachersCanViewAll: boolean; showLateButton: boolean };

// app_settings는 단일 행(id = true)이다. 활성 사용자는 누구나 조회할 수 있다(app_settings_select).
export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('teachers_can_view_all, show_late_button')
    .single();
  if (error) throw new Error(`app_settings 조회 실패: ${error.message}`);
  return { teachersCanViewAll: data.teachers_can_view_all, showLateButton: data.show_late_button };
}

// 관리자만 변경할 수 있다(app_settings_update). 변경할 때마다 updated_by/updated_at을 함께 갱신한다.
export async function updateAppSettings(patch: Partial<AppSettings>, updatedBy: string): Promise<void> {
  const supabase = await createClient();

  const update: TablesUpdate<'app_settings'> = { updated_by: updatedBy, updated_at: new Date().toISOString() };
  if (patch.teachersCanViewAll !== undefined) update.teachers_can_view_all = patch.teachersCanViewAll;
  if (patch.showLateButton !== undefined) update.show_late_button = patch.showLateButton;

  const { data, error } = await supabase.from('app_settings').update(update).eq('id', true).select('id');
  if (error) throw new Error(`app_settings 수정 실패: ${error.message}`);
  assertAffected(data, 'app_settings 수정');
}
