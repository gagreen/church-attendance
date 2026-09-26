-- 교사 출석 (docs/screens/teacher-attendance.md).
-- 학생 출석(attendance)과 섞지 않고 별도 테이블로 둔다: attendance는 student_id·class_id가 not null이고
-- 통계 함수(class_month_stats 등)가 학생 기준이라, 합치면 기존 통계 숫자가 오염된다.
-- class_id는 두지 않는다 — 교사는 여러 반을 맡을 수 있고(다대다), "그 당시 담당 반"을 남길 실익이 없다.

-- 1) 테이블
create table teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  teacher_id uuid not null references teachers(id), -- 출석 대상 교사
  status text not null check (status in ('출석', '지각', '결석', '공예배')),
  comment text,
  recorded_by uuid not null references teachers(id),
  recorded_at timestamptz not null default now(),
  last_modified_by uuid not null references teachers(id),
  last_modified_at timestamptz not null default now(),
  unique (date, teacher_id)
);

create index teacher_attendance_teacher_date_idx on teacher_attendance (teacher_id, date desc);

-- 2) 감사 필드 트리거 (0004와 같은 패턴): 최초 입력자만 recorded_*로 남기고, last_modified_at은 서버 시각으로 강제.
create or replace function teacher_attendance_set_audit_fields() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.recorded_by := old.recorded_by;
    new.recorded_at := old.recorded_at;
  end if;
  new.last_modified_at := now();
  return new;
end;
$$;

create trigger teacher_attendance_set_audit_fields_trigger
  before insert or update on teacher_attendance
  for each row execute function teacher_attendance_set_audit_fields();

-- 3) 헬퍼: 출석 대상 교사(활성 role='teacher')인지.
-- security definer: teachers는 본인·관리자만 select 가능해서, 일반 교사·목사님이 RLS 안에서 직접 조회하면
-- 다른 교사 행이 안 보여 항상 false가 된다.
create or replace function is_attendance_teacher(target_teacher_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teachers where id = target_teacher_id and role = 'teacher' and is_active
  )
$$;

-- 4) RLS. 조회·쓰기 모두 활성 사용자 전원(교사·관리자·목사님). 목사님은 다른 데이터에서는 조회 전용이지만
-- 이 테이블만 예외로 쓰기를 허용한다. 반에 종속되지 않으므로 can_access_class/teachers_can_view_all과 무관하다.
-- 쓰기 대상 검증을 with check에 둔 이유: Server Action 검증이 누락돼도 관리자·목사님 행이 저장되지 않게 하기 위함.
alter table teacher_attendance enable row level security;

create policy teacher_attendance_select on teacher_attendance for select
  using (current_role_name() is not null);
create policy teacher_attendance_write on teacher_attendance for all
  using (current_role_name() is not null)
  with check (current_role_name() is not null and is_attendance_teacher(teacher_id));

-- GRANT (0002의 설명 참고 — 클라우드는 기본 GRANT가 있고 로컬 `supabase start`에는 없다). delete는 쓰지 않는다.
grant select, insert, update on teacher_attendance to authenticated;

-- 5) 출석 대상 교사 명단. teachers/teacher_classes는 본인·관리자만 조회 가능하므로 security definer 함수로
-- 필요한 컬럼(id, 이름, 활성 담당 반 이름)만 노출한다 — 이메일 등 다른 컬럼은 내려주지 않는다.
create or replace function list_attendance_teachers()
returns table (id uuid, name text, class_names text[])
language sql stable security definer set search_path = public as $$
  select
    t.id,
    t.name,
    coalesce(array_agg(c.name order by c.name) filter (where c.id is not null), '{}')
  from teachers t
  left join teacher_classes tc on tc.teacher_id = t.id
  left join classes c on c.id = tc.class_id and c.is_active
  where current_role_name() is not null
    and t.role = 'teacher'
    and t.is_active
  group by t.id, t.name
$$;

revoke execute on function list_attendance_teachers() from public, anon;
grant execute on function list_attendance_teachers() to authenticated;
revoke execute on function is_attendance_teacher(uuid) from public, anon;
grant execute on function is_attendance_teacher(uuid) to authenticated;
