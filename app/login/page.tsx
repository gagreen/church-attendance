import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAccess, type Access } from '@/lib/auth';
import { safeNextPath } from '@/lib/redirect';
import { LoginButton } from '@/components/LoginButton';
import { SignOutButton } from '@/components/SignOutButton';

export const metadata: Metadata = { title: '로그인 · 교회 출석 관리' };

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed:
    '등록되지 않았거나 비활성화된 계정입니다. 담당 관리자에게 이 Google 계정의 등록을 요청해 주세요.',
  auth_failed: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  cancelled: '로그인이 취소되었습니다.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error, next } = await searchParams;
  const nextPath = safeNextPath(next);

  // DB 오류 등으로 조회가 실패해도 로그인 화면이 죽지 않게 한다 — 세션이 남은 채 에러 화면에
  // 갇혀 로그아웃조차 못 하는 상태를 막기 위함이다.
  let access: Access | undefined;
  try {
    access = await getAccess();
  } catch (e) {
    console.error('로그인 화면에서 접근 상태 확인 실패:', e);
  }
  if (access?.status === 'ok') redirect(nextPath);

  // 로그인은 되어 있지만 화이트리스트에서 빠진 계정(예: 비활성화된 교사의 남은 세션)
  const forbidden = access?.status === 'forbidden';
  const checkFailed = access === undefined;
  const errorKey = forbidden
    ? 'not_allowed'
    : checkFailed
      ? 'auth_failed'
      : typeof error === 'string'
        ? error
        : undefined;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-center text-2xl font-semibold">교회 출석 관리</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          등록된 교사 계정으로 로그인해 주세요.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
            {access?.status === 'forbidden' && access.email && (
              <span className="mt-1 block text-xs opacity-80">현재 계정: {access.email}</span>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <LoginButton next={nextPath === '/' ? undefined : nextPath} />
          {(forbidden || checkFailed) && <SignOutButton />}
        </div>
      </div>
    </main>
  );
}
