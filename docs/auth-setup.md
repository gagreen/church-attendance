# 로그인(Google OAuth) 설정 가이드

코드는 구현되어 있고, 아래 **콘솔 설정**을 마쳐야 실제 로그인이 동작한다. (Supabase 프로젝트의 Google 프로바이더는 기본 꺼져 있다.)

## 로그인 흐름

```
/login  →  "Google 계정으로 로그인" (Server Action signInWithGoogle)
        →  Supabase Auth  →  Google 계정 선택/동의
        →  /auth/callback?code=...&next=...   (Route Handler)
             ├ code → 세션 교환 (exchangeCodeForSession)
             ├ teachers 화이트리스트 대조 (id = auth.users.id, is_active = true)
             │    ├ 통과  → next(기본 "/")로 이동
             │    └ 실패  → 세션 폐기 후 /login?error=not_allowed
             └ 오류/취소 → /login?error=auth_failed | cancelled
```

- `proxy.ts`: 세션 쿠키가 없으면 `/login?next=<원래 경로>`로 보낸다(낙관적 체크). 실제 권한 판단은 각 페이지/Server Action 진입부의 `requireTeacher()`([lib/auth.ts](../lib/auth.ts))가 한다.
- `next` 파라미터는 `safeNextPath()`([lib/redirect.ts](../lib/redirect.ts))로 사이트 내부 경로만 허용한다.

## 1. Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 선택/생성 → **APIs & Services → OAuth consent screen**
   - User Type: External. 앱 이름·지원 이메일 입력. 스코프는 기본(`email`, `profile`, `openid`)이면 충분하다.
   - 교사 수가 적으므로 게시 상태는 "Testing"으로 두고 **Test users**에 교사 Google 계정을 추가해도 되지만, 100명 제한·토큰 7일 만료가 있으므로 운영 시에는 "In production"(민감 스코프 없어 검수 불필요)을 권장한다.
2. **Credentials → Create Credentials → OAuth client ID** → Application type: **Web application**
   - **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback` (로컬 Supabase CLI를 쓴다면 `http://127.0.0.1:54321/auth/v1/callback`도 추가)
   - Authorized JavaScript origins는 비워도 된다(브라우저에서 Google로 직접 가지 않고 Supabase를 거친다).
3. 발급된 **Client ID / Client Secret**을 복사한다.

## 2. Supabase 대시보드

1. **Authentication → Providers → Google**: Enable, 위 Client ID / Secret 입력 후 저장.
2. **Authentication → URL Configuration**
   - **Site URL**: 프로덕션 도메인 (예: `https://<app>.vercel.app`)
   - **Redirect URLs**에 추가:
     - `http://localhost:3000/auth/callback`
     - `https://<app>.vercel.app/auth/callback`
     - (프리뷰 배포까지 로그인하려면) `https://*-<team>.vercel.app/auth/callback` 같은 와일드카드
   - 앱은 요청 origin으로 `redirectTo`를 만들기 때문에, 여기에 없는 origin에서 로그인하면 Supabase가 Site URL로 되돌려 보낸다.

## 3. 교사 등록 (화이트리스트)

`teachers.id`는 `auth.users.id`를 참조하므로, **그 사람이 Google로 한 번 로그인을 시도해 `auth.users`에 행이 생긴 뒤에** 등록할 수 있다. (첫 시도는 `not_allowed`로 막히는 것이 정상이다.)

Supabase SQL Editor에서 이메일로 등록:

```sql
-- 관리자
insert into teachers (id, email, name, role)
select id, email, '홍길동', 'admin'
from auth.users where email = 'admin@example.com';

-- 교사 + 담당 반 매핑
insert into teachers (id, email, name, role)
select id, email, '김교사', 'teacher'
from auth.users where email = 'teacher@example.com';

insert into teacher_classes (teacher_id, class_id)
select t.id, c.id from teachers t, classes c
where t.email = 'teacher@example.com' and c.name = '1반';

-- 목사님 (전체 조회 전용)
insert into teachers (id, email, name, role)
select id, email, '김목사', 'pastor'
from auth.users where email = 'pastor@example.com';
```

교사의 전체 반 접근은 관리자가 스위치(`app_settings.teachers_can_view_all`, 기본 `true`)로 끄고 켠다. 관리 화면(P3)이 생기기 전에는 SQL로 바꾼다:

```sql
update app_settings set teachers_can_view_all = false;  -- 담당 반만 허용
```

비활성화(퇴임 등)는 `update teachers set is_active = false where email = '...'` — 다음 요청부터 접근이 막힌다. (교사·학생 관리 화면은 P3에서 구현 예정.)

## 4. 로컬 검증 체크리스트

- [ ] 로그아웃 상태로 `/` 접속 → `/login`으로 이동
- [ ] 등록되지 않은 Google 계정으로 로그인 → "등록되지 않았거나 비활성화된 계정" 안내, 세션 없음
- [ ] 관리자 등록 후 로그인 → `/` 진입, 이름·역할 표시
- [ ] 로그아웃 → `/login`
- [ ] `is_active = false`로 바꾼 뒤 새로고침 → `/login`에 안내 문구 + 로그아웃 버튼
