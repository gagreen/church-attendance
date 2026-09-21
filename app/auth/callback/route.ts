import { NextResponse, type NextRequest } from 'next/server';
import { completeSignIn } from '@/lib/auth';
import { safeNextPath } from '@/lib/redirect';

// Google → Supabase → 이 경로로 돌아온다(?code=...). 코드를 세션으로 교환한 뒤 화이트리스트를 확인한다.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const toLogin = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, request.url));

  // 사용자가 Google 동의 화면에서 취소한 경우 등 (?error=access_denied)
  if (searchParams.get('error')) {
    return toLogin(searchParams.get('error') === 'access_denied' ? 'cancelled' : 'auth_failed');
  }

  const code = searchParams.get('code');
  if (!code) return toLogin('auth_failed');

  let result: Awaited<ReturnType<typeof completeSignIn>>;
  try {
    result = await completeSignIn(code);
  } catch (e) {
    // teachers 조회 실패 등 예기치 못한 오류 — 사용자에겐 일반 실패로 안내하고 원인은 서버 로그에 남긴다.
    console.error('로그인 완료 처리 중 예외:', e);
    return toLogin('auth_failed');
  }
  if (!result.ok) return toLogin(result.reason);

  return NextResponse.redirect(new URL(safeNextPath(searchParams.get('next')), request.url));
}
