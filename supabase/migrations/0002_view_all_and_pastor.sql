-- 교사 전체 학생 접근(관리자가 끌 수 있음) + 목사님(pastor, 조회 전용) 역할 추가.
-- 상세 설명은 docs/data-model-guide.md 참고.

-- 1) 목사님 역할 추가
alter table teachers drop constraint teachers_role_check;
alter table teachers add constraint teachers_role_check
  check (role in ('admin', 'teacher', 'pastor'));

-- 2) 전역 설정 (단일 행 강제: id는 항상 true)
create table app_settings (
  id boolean primary key default true check (id),
  -- true: 모든 교사가 모든 반을 조회·수정 / false: teacher_classes에 매핑된 담당 반만
  teachers_can_view_all boolean not null default true,
  updated_by uuid references teachers(id),
  updated_at timestamptz not null default now()
);
insert into app_settings default values;
alter table app_settings enable row level security;

-- 3) 헬퍼 함수
-- security definer: 헬퍼가 teachers를 조회할 때 teachers의 RLS 정책(is_admin() 호출)이 다시 평가되어
-- 재귀하는 것을 막는다. search_path를 고정해 스키마 가로채기를 방지한다.
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

-- 4) 정책
create policy app_settings_select on app_settings for select
  using (current_role_name() is not null);
create policy app_settings_update on app_settings for update
  using (is_admin()) with check (is_admin());

-- 조회 정책에 목사님 허용 추가 (쓰기 정책은 can_access_class 그대로 → 목사님 쓰기 불가)
drop policy students_select on students;
create policy students_select on students for select
  using (can_access_class(class_id) or is_pastor());

drop policy attendance_select on attendance;
create policy attendance_select on attendance for select
  using (can_access_class(class_id) or is_pastor());

drop policy student_notes_select on student_notes;
create policy student_notes_select on student_notes for select
  using (
    is_pastor()
    or exists (
      select 1 from students
      where students.id = student_notes.student_id
      and can_access_class(students.class_id)
    )
  );

-- 5) 인덱스: 학생 상세(학생별 이력)·반별 조회용. unique(date, student_id)는 student_id 단독 조회를 커버하지 못한다.
create index attendance_student_date_idx on attendance (student_id, date desc);
create index attendance_class_date_idx on attendance (class_id, date);
create index students_class_idx on students (class_id);
