import { requireTeacher } from '@/lib/auth';
import { getAttendanceInitialContext } from '@/app/actions/attendance';
import { AttendanceScreen } from '@/components/attendance/AttendanceScreen';
import { SignOutButton } from '@/components/SignOutButton';

const ROLE_LABELS = { admin: '관리자', teacher: '교사', pastor: '목사님' } as const;

export default async function Home() {
  const teacher = await requireTeacher();
  const initialContext = await getAttendanceInitialContext();

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">교회 출석 관리</p>
            <p className="text-xs text-zinc-500">
              {teacher.name} · {ROLE_LABELS[teacher.role as keyof typeof ROLE_LABELS] ?? teacher.role}
            </p>
          </div>
          <SignOutButton className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800" />
        </div>
      </header>
      <AttendanceScreen initialContext={initialContext} readOnly={teacher.role === 'pastor'} />
    </main>
  );
}
