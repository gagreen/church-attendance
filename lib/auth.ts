import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { findActiveTeacherById, type Teacher } from '@/lib/db/teachers';

export type { Teacher };

export type Access =
  | { status: 'unauthenticated' }
  // Google 로그인은 성공했지만 teachers 화이트리스트에 없거나 비활성인 계정
  | { status: 'forbidden'; email: string | undefined }
  | { status: 'ok'; teacher: Teacher };

// 현재 요청의 접근 상태. Supabase Auth는 Google 계정이면 누구나 로그인에 성공시키므로,
// 실제 허용 여부는 반드시 teachers 테이블로 판단한다. 요청당 한 번만 계산한다(cache).
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient();
  // getSession()은 쿠키를 검증 없이 신뢰하므로 서버에서는 getUser()로 토큰을 확인한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'unauthenticated' };

  const teacher = await findActiveTeacherById(user.id);
  if (!teacher) return { status: 'forbidden', email: user.email };
  return { status: 'ok', teacher };
});

// 보호된 페이지/Server Action 진입부에서 호출한다. 허용된 교사가 아니면 로그인 화면으로 보낸다.
export async function requireTeacher(): Promise<Teacher> {
  const access = await getAccess();
  if (access.status === 'ok') return access.teacher;
  redirect(access.status === 'forbidden' ? '/login?error=not_allowed' : '/login');
}

// OAuth 콜백 URL의 기준이 되는 현재 사이트 origin. 로컬·Vercel(프로덕션/프리뷰)에서 코드 변경 없이 동작하도록
// 요청 헤더에서 구한다. 이 값은 Supabase Auth의 Redirect URLs 허용 목록에 등록되어 있어야 한다.
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  if (!host) throw new Error('요청 host를 확인할 수 없습니다.');
  return `${proto}://${host}`;
}

// Google 로그인 시작: Supabase가 만들어준 Google 인증 URL을 반환한다(PKCE verifier는 쿠키에 저장됨).
export async function startGoogleSignIn(
  next: string
): Promise<{ ok: true; url: string } | { ok: false }> {
  const supabase = await createClient();
  const redirectTo = `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // 교회 공용 기기에서 다른 계정으로 바꿔 로그인할 수 있도록 매번 계정 선택 화면을 띄운다.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) {
    console.error('Google 로그인 시작 실패:', error?.message);
    return { ok: false };
  }
  return { ok: true, url: data.url };
}

export type SignInFailure = 'auth_failed' | 'not_allowed';

// OAuth 콜백에서 받은 code를 세션으로 교환하고, 화이트리스트에 없으면 즉시 세션을 폐기한다.
export async function completeSignIn(code: string): Promise<{ ok: true } | { ok: false; reason: SignInFailure }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('세션 교환 실패:', error.message);
    return { ok: false, reason: 'auth_failed' };
  }

  const access = await getAccess();
  if (access.status === 'ok') return { ok: true };
  if (access.status === 'forbidden') {
    await supabase.auth.signOut({ scope: 'local' });
    return { ok: false, reason: 'not_allowed' };
  }
  return { ok: false, reason: 'auth_failed' };
}

export async function signOutCurrentUser(): Promise<void> {
  const supabase = await createClient();
  // 'local': 이 기기의 세션만 종료한다 — 다른 기기(예: 교사의 휴대폰) 로그인은 유지된다.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) console.error('로그아웃 실패:', error.message);
}
