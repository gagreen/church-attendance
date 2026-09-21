import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

// 로그인 없이 접근 가능한 경로
function isPublicPath(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/auth/');
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 만료된 세션을 갱신 — Server Component는 쿠키를 쓸 수 없으므로 이 단계에서 처리한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 낙관적 체크: 세션이 아예 없으면 로그인 화면으로 보낸다. teachers 화이트리스트 대조 같은
  // 실제 권한 판단은 여기(모든 요청·프리페치마다 실행됨)가 아니라 페이지의 requireTeacher()가 한다.
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    const target = request.nextUrl.pathname + request.nextUrl.search;
    if (target !== '/') loginUrl.searchParams.set('next', target);

    const redirect = NextResponse.redirect(loginUrl);
    // 세션 갱신 중 발급된 쿠키가 리다이렉트 응답에서 유실되지 않도록 옮겨 담는다.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
