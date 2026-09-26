import { requireAdmin } from '@/lib/auth';
import { getMasterManagementData } from '@/app/actions/settings';
import { AppHeader } from '@/components/AppHeader';
import { SettingsScreen } from '@/components/settings/SettingsScreen';

// 관리자 전용. requireAdmin이 관리자가 아니면 홈으로 돌려보낸다(메뉴에도 관리자에게만 보인다).
export default async function SettingsPage() {
  const teacher = await requireAdmin();
  const data = await getMasterManagementData();

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader teacher={teacher} current="settings" />
      <SettingsScreen data={data} />
    </main>
  );
}
