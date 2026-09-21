-- 초기 스키마: teachers, classes, teacher_classes, students, attendance, student_notes
-- 상세 설명은 docs/data-model-guide.md 참고. 이 파일을 Supabase Studio에서 직접 고치지 말고
-- 항상 새 마이그레이션 파일을 추가하는 방식으로 스키마를 변경한다.

-- teachers: 로그인 화이트리스트 + 역할
create table teachers (
  id uuid primary key references auth.users(id),
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'teacher')),
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

-- attendance: 출석 기록 (1행 = 1명 x 1일)
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

-- RLS 활성화
alter table teachers enable row level security;
alter table classes enable row level security;
alter table teacher_classes enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table student_notes enable row level security;

-- 헬퍼: 현재 로그인 사용자가 활성 관리자인지
create or replace function is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from teachers
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- 헬퍼: 현재 로그인 사용자가 활성 교사(관리자 포함)이고, 해당 반에 접근 가능한지
create or replace function can_access_class(target_class_id uuid)
returns boolean language sql stable as $$
  select
    exists (select 1 from teachers where id = auth.uid() and is_active = true)
    and (
      is_admin()
      or exists (
        select 1 from teacher_classes
        where teacher_id = auth.uid() and class_id = target_class_id
      )
    );
$$;

-- classes: 활성 교사는 전체 조회 가능(반 선택 화면), 쓰기는 관리자만
create policy classes_select on classes for select
  using (exists (select 1 from teachers where id = auth.uid() and is_active = true));
create policy classes_write on classes for all
  using (is_admin()) with check (is_admin());

-- students: 담당 반 학생만 조회/수정, 관리자는 전체
create policy students_select on students for select
  using (can_access_class(class_id));
create policy students_write on students for all
  using (can_access_class(class_id)) with check (can_access_class(class_id));

-- attendance: 담당 반 기록만 조회/입력/수정 (과거 날짜 수정 잠금 없음 — 반 권한만 확인)
create policy attendance_select on attendance for select
  using (can_access_class(class_id));
create policy attendance_write on attendance for all
  using (can_access_class(class_id)) with check (can_access_class(class_id));

-- student_notes: 학생이 속한 반 기준으로 접근 판단
create policy student_notes_select on student_notes for select
  using (exists (
    select 1 from students where students.id = student_notes.student_id
    and can_access_class(students.class_id)
  ));
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
