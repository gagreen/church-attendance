import { requireTeacher } from '@/lib/auth';
import { SignOutButton } from '@/components/SignOutButton';

const ROLE_LABELS = { admin: '관리자', teacher: '교사', pastor: '목사님' } as const;

export default async function Home() {
  const teacher = await requireTeacher();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">교회 출석 관리</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {teacher.name} · {ROLE_LABELS[teacher.role as keyof typeof ROLE_LABELS] ?? teacher.role}
          </p>
        </div>
        <SignOutButton />
      </header>
      <p className="text-sm text-zinc-500">
        로그인되었습니다. 반 선택·출석 입력 화면은 아직 구현 전입니다.
      </p>
    </main>
  );
}
