# 데이터 모델 가이드 — Supabase Postgres

[CLAUDE.md](../CLAUDE.md)의 데이터 모델 요약을 구현 가능한 수준으로 풀어쓴 문서. 스키마·RLS·마이그레이션을 다룰 때 이 문서를 먼저 확인한다.

## 설계 원칙

- 기존 Google Sheet의 "학생 행 × 날짜 행이 쌓이는 세로형(long format)" 구조를 그대로 유지한다 — 조회·통계 쿼리를 단순하게 유지하기 위함이다. `attendance` 테이블이 중심이라는 점은 스택이 바뀌어도 동일하다.
- 기본키는 전부 `uuid default gen_random_uuid()`를 쓴다. 기존 시트에서 쓰던 `c01`/`s014`/`a1042`/`n003` 같은 사람이 읽기 좋은 코드형 ID는 더 이상 만들지 않는다 — 수동 채번 로직이 사라지는 것이 관계형 DB 전환의 이득 중 하나이므로, 화면에 표시할 때는 `name`/`date` 등 실제 값으로 보여주고 uuid는 노출하지 않는다.
- 정규화 원칙: 한 사실은 한 곳에만 저장한다. 예외적으로 `attendance.class_id`는 `students.class_id`와 별개로 유지하는데, 이는 정규화 위반이 아니라 "그 날짜 시점에 속했던 반"이라는 별개의 사실이기 때문이다(아래 "반 이동 처리" 참고).
- 모든 테이블에 RLS(Row Level Security)를 활성화한다. 클라이언트(브라우저)는 `anon` 키로만 접근하므로, 권한 체크를 애플리케이션 코드에만 의존하지 않고 DB가 강제한다.

## Supabase 초기 세팅 체크리스트

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 티어, 리전은 한국에서 가까운 곳 예: Northeast Asia).
2. Authentication → Providers → Google 활성화. Google Cloud Console에서 발급한 Client ID/Secret 등록, 리디렉션 URL(`https://<project-ref>.supabase.co/auth/v1/callback`)을 Google OAuth 클라이언트에도 등록.
3. Authentication → URL Configuration에 로컬(`http://localhost:3000`)과 프로덕션(Vercel 도메인) 리디렉션 URL을 모두 추가.
4. Database → Extensions에서 `pgcrypto`(uuid 생성용) 활성화 확인 — Supabase는 기본으로 켜져 있는 경우가 많지만 확인 필요.
5. 로컬에서 `supabase init` → `supabase link --project-ref <project-ref>` 후, 아래 스키마를 `supabase/migrations/0001_init.sql`로 작성하고 `supabase db push`.
6. 관리자 계정 1명을 `teachers` 테이블에 `role='admin'`으로 시드(seed) — 처음엔 SQL Editor에서 직접 insert. `teachers.id`가 `auth.users.id`를 참조하므로 그 계정이 Google 로그인을 한 번 시도한 뒤에 `auth.users`에서 id를 가져와 insert한다(예시 SQL: [auth-setup.md](auth-setup.md#3-교사-등록-화이트리스트)).

## 테이블 스키마

```sql
-- teachers: 로그인 화이트리스트 + 역할
create table teachers (
  id uuid primary key references auth.users(id),
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'teacher', 'pastor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- classes: 반 마스터
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- teacher_classes: 교사 ↔ 반 다대다 매핑
create table teacher_classes (
  teacher_id uuid not null references teachers(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  primary key (teacher_id, class_id)
);

-- students: 학생 마스터
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id uuid not null references classes(id),
  enrolled_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- attendance: 출석 기록 (1행 = 1명 × 1일)
create table attendance (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  class_id uuid not null references classes(id),
  student_id uuid not null references students(id),
  status text not null check (status in ('출석', '지각', '결석', '공예배')),
  comment text,
  recorded_by uuid not null references teachers(id),
  recorded_at timestamptz not null default now(),
  last_modified_by uuid not null references teachers(id),
  last_modified_at timestamptz not null default now(),
  unique (date, student_id)
);

-- student_notes: 학생 프로필 메모 (날짜 무관, 지속 특이사항)
create table student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  note text not null,
  created_by uuid not null references teachers(id),
  created_at timestamptz not null default now()
);

-- app_settings: 전역 설정 (단일 행. id는 항상 true)
create table app_settings (
  id boolean primary key default true check (id),
  teachers_can_view_all boolean not null default true,
  updated_by uuid references teachers(id),
  updated_at timestamptz not null default now()
);
```

### 컬럼 설명이 필요한 부분

- `teachers.role`: `admin`(전체 조회·수정 + 마스터 관리), `teacher`(담당 반, 또는 `app_settings.teachers_can_view_all`이 켜져 있으면 전체 반 조회·수정), `pastor`(목사님 — 전체 조회 전용, 수정 불가). 로그인 화이트리스트가 `teachers` 하나이므로 목사님도 이 테이블에 등록한다.
- `app_settings.teachers_can_view_all`: 전체 교사 일괄 스위치. `true`(기본값)면 모든 교사가 모든 반의 학생·출석·`student_notes`·`attendance.comment`를 조회하고 수정할 수 있다. 관리자가 `false`로 끄면 `teacher_classes`에 매핑된 담당 반만 허용된다. 읽기와 쓰기 권한은 분리하지 않는다. 교사별 개별 설정은 두지 않는다. 판단은 RLS(`can_access_class`)가 한 곳에서 하므로 앱 코드는 스위치 값을 따로 검사하지 않는다(메뉴 노출 여부 등 UI 분기에만 참고).

- `attendance` unique `(date, student_id)`: 같은 학생이 같은 날 두 번 기록되는 것을 DB가 막는다. 저장 로직은 "있으면 update, 없으면 insert"가 아니라 `upsert(onConflict: 'date,student_id')`로 짠다 — 두 교사가 동시에 같은 학생·같은 날짜를 저장해도 경합 없이 하나로 수렴한다.
- `attendance.recorded_by`/`last_modified_by`는 `teachers.id`(uuid, Supabase Auth 사용자 id와 동일)를 참조한다. 화면에 표시할 이름이 필요하면 조인해서 가져온다 — 별도 텍스트 컬럼으로 이름을 중복 저장하지 않는다.
- `classes`에는 담당 교사 컬럼을 두지 않는다. "이 반 담당 교사가 누구인지"는 `teacher_classes` 조인으로 구한다.

### 인덱스

`attendance(student_id, date desc)`(학생 상세의 출석 이력), `attendance(class_id, date)`(반별 조회), `students(class_id)`(반별 학생 목록·RLS 조인). `unique(date, student_id)`는 `student_id` 단독 조회를 커버하지 못해서 별도로 둔다.

## RLS 정책

기본 방침: `teachers.is_active = true`인 사용자만 무언가를 할 수 있다. `role='admin'`은 전체, `role='teacher'`는 `app_settings.teachers_can_view_all`이 켜져 있으면 전체 반, 꺼져 있으면 `teacher_classes`에 매핑된 반만 허용한다(조회·수정 동일). `role='pastor'`는 전체 조회만 가능하고 수정은 못 한다. 아래는 `0001_init.sql` + `0002_view_all_and_pastor.sql`을 합친 최종 상태다.

```sql
alter table teachers enable row level security;
alter table classes enable row level security;
alter table teacher_classes enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table student_notes enable row level security;
alter table app_settings enable row level security;

-- 헬퍼는 모두 security definer + search_path 고정: 헬퍼가 teachers를 조회할 때 teachers의 RLS 정책이
-- 다시 헬퍼를 호출해 재귀하는 것을 막는다.
create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from teachers where id = auth.uid() and is_active
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_name() = 'admin', false)
$$;

create or replace function is_pastor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_name() = 'pastor', false)
$$;

-- 반 접근(조회·수정 공통). 목사님은 조회 전용이므로 여기서 제외하고 select 정책에서 따로 허용한다.
create or replace function can_access_class(target_class_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case current_role_name()
    when 'admin' then true
    when 'teacher' then
      (select teachers_can_view_all from app_settings)
      or exists (
        select 1 from teacher_classes
        where teacher_id = auth.uid() and class_id = target_class_id
      )
    else false
  end
$$;

-- app_settings: 활성 사용자는 조회, 수정은 관리자만
create policy app_settings_select on app_settings for select
  using (current_role_name() is not null);
create policy app_settings_update on app_settings for update
  using (is_admin()) with check (is_admin());

-- classes: 활성 교사는 전체 조회 가능(반 선택 화면에서 목록은 봐야 함), 쓰기는 관리자만
create policy classes_select on classes for select
  using (exists (select 1 from teachers where id = auth.uid() and is_active = true));
create policy classes_write on classes for all
  using (is_admin()) with check (is_admin());

-- students: 접근 가능한 반의 학생만 조회/수정 (목사님은 전체 조회)
create policy students_select on students for select
  using (can_access_class(class_id) or is_pastor());
create policy students_write on students for all
  using (can_access_class(class_id)) with check (can_access_class(class_id));

-- attendance: 접근 가능한 반의 기록만 조회/입력/수정 (과거 날짜 수정 잠금 없음 — 반 권한만 확인. 목사님은 전체 조회)
create policy attendance_select on attendance for select
  using (can_access_class(class_id) or is_pastor());
create policy attendance_write on attendance for all
  using (can_access_class(class_id)) with check (can_access_class(class_id));

-- student_notes: 학생이 속한 반 기준으로 접근 판단 (목사님은 전체 조회)
create policy student_notes_select on student_notes for select
  using (
    is_pastor()
    or exists (
      select 1 from students where students.id = student_notes.student_id
      and can_access_class(students.class_id)
    )
  );
create policy student_notes_write on student_notes for all
  using (exists (
    select 1 from students where students.id = student_notes.student_id
    and can_access_class(students.class_id)
  ));

-- teachers, teacher_classes: 관리자만 관리, 본인 행은 조회 가능(로그인 시 본인 role 확인용)
create policy teachers_select_self on teachers for select
  using (id = auth.uid() or is_admin());
create policy teachers_write on teachers for all
  using (is_admin()) with check (is_admin());
create policy teacher_classes_select on teacher_classes for select
  using (teacher_id = auth.uid() or is_admin());
create policy teacher_classes_write on teacher_classes for all
  using (is_admin()) with check (is_admin());
```

정책을 추가/수정할 때마다 교사·관리자·목사님 계정으로, 그리고 `teachers_can_view_all`을 켠 상태/끈 상태 양쪽에서 실제 조회·쓰기 동작을 확인한다 — RLS는 조건을 하나만 잘못 걸어도 "테이블은 있는데 아무것도 안 보이는" 문제가 조용히 발생한다.

## 마이그레이션 관리

- 모든 스키마 변경은 `supabase/migrations/NNNN_설명.sql` 파일로 작성하고 git으로 버전 관리한다. Supabase Studio(웹 UI)에서 테이블을 직접 고치고 마이그레이션 파일에 반영하지 않는 방식은 로컬 스키마와 실제 DB가 어긋나는(drift) 원인이 되므로 지양한다.
- 컬럼 추가/제약조건 변경처럼 기존 데이터에 영향을 주는 마이그레이션은 로컬(`supabase start`)에서 먼저 검증한 뒤 `supabase db push`로 반영한다.

## 반 이동 처리

학생이 다른 반으로 옮기면 `students.class_id`만 새 반으로 `update`한다. 이미 쌓인 `attendance` 행들의 `class_id`는 건드리지 않는다 — "그 날짜에 어느 반 소속으로 출석했는지"라는 과거 사실이 바뀌면 안 되기 때문이다. 따라서:

- "현재 이 반 학생 목록"이 필요하면 `students.class_id`로 조회.
- "이 반의 과거 출석 이력"이 필요하면 `attendance.class_id`로 조회 (반이 바뀌기 전 학생의 기록도 그 반에 남아 있어야 정확함).

## 엑셀 내보내기 쿼리 가이드

엑셀 산출물은 화면에 필요한 최소 컬럼만 내려주는 조회 함수와 별개로, 내보내기 전용 쿼리에서는 조인해서 사람이 읽을 수 있는 형태로 만든다.

- **출석 기록 원본 내보내기 (P1)**: `attendance` × `students.name` × `classes.name` × `teachers.name`(recorded_by/last_modified_by) 조인. 컬럼 예시: 날짜, 반 이름, 학생 이름, 상태, 코멘트, 기록자, 최종수정자, 최종수정시각.
- **통계 리포트 내보내기 (P3)**: 반별/학생별로 `status`를 `group by`해서 월간 집계(출석/지각/결석/공예배 횟수, 출석률)한 결과를 내보낸다. 집계는 Postgres 쪽에서 SQL로 계산하고(뷰 또는 함수), Next.js는 결과 행을 `exceljs`로 `.xlsx`로 변환하는 역할만 한다 — 통계 로직을 클라이언트나 애플리케이션 코드에 중복 구현하지 않는다.
- 내보내기 Route Handler는 `lib/xlsx.ts`의 공통 헬퍼(행 배열 → `.xlsx` 응답)를 통해서만 파일을 생성한다 — 화면마다 `exceljs` 호출 코드를 따로 짜지 않는다.
