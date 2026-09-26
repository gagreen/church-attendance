import { requireTeacher } from '@/lib/auth';
import { getAttendanceInitialContext } from '@/app/actions/attendance';
import { AppHeader } from '@/components/AppHeader';
import { AttendanceScreen } from '@/components/attendance/AttendanceScreen';

export default async function Home() {
  const teacher = await requireTeacher();
  const initialContext = await getAttendanceInitialContext();

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader teacher={teacher} current="attendance" />
      <AttendanceScreen initialContext={initialContext} readOnly={teacher.role === 'pastor'} />
    </main>
  );
}
