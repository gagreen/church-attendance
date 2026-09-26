import Link from 'next/link';
import type { Teacher } from '@/lib/auth';
import { SignOutButton } from '@/components/SignOutButton';

const ROLE_LABELS = { admin: '관리자', teacher: '교사', pastor: '목사님' } as const;

const NAV_ITEMS = [
  { key: 'attendance', href: '/', label: '출석' },
  { key: 'statistics', href: '/statistics', label: '통계' },
  // 마스터 관리·전역 설정: 관리자에게만 보인다(화면·액션도 requireAdmin으로 별도 차단).
  { key: 'settings', href: '/settings', label: '설정', adminOnly: true },
] as const;

export type AppNavKey = (typeof NAV_ITEMS)[number]['key'];

// 상단 공용 헤더: 사용자 정보 + 화면 이동 + 로그아웃. 화면이 늘어나면 NAV_ITEMS에 항목을 추가한다.
export function AppHeader({ teacher, current }: { teacher: Teacher; current: AppNavKey }) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold">교회 출석 관리</p>
          <p className="text-xs text-zinc-500">
            {teacher.name} · {ROLE_LABELS[teacher.role as keyof typeof ROLE_LABELS] ?? teacher.role}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="주요 화면" className="flex items-center gap-1">
            {NAV_ITEMS.filter((item) => !('adminOnly' in item) || teacher.role === 'admin').map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === current ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  item.key === current
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SignOutButton className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800" />
        </div>
      </div>
    </header>
  );
}
