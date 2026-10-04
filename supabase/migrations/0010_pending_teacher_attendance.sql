-- 가입 전(초대 대기) 교사의 출석 기록 (docs/screens/teacher-attendance.md).
-- teacher_attendance.teacher_id는 teachers(id)를 참조하고 teachers.id는 auth.users(id)를 참조하므로,
-- 첫 로그인 전에는 FK를 만족하는 행을 만들 수 없다. 그래서 행마다 "활성 교사" 또는 "교사 초대" 중
-- 정확히 하나를 가리키게 하고, 초대 쪽 행은 claim_teacher_invite()가 첫 로그인 때 teacher_id로 옮긴다.

-- 1) 대상 식별자: teacher_id 또는 invite_id 중 정확히 하나
alter table teacher_attendance alter column teacher_id drop not null;
alter table teacher_attendance
  add column invite_id uuid references teacher_invites(id) on delete cascade;
alter table teacher_attendance
  add constraint teacher_attendance_one_target check (num_nonnulls(teacher_id, invite_id) = 1);
-- 일반 unique(부분 인덱스 아님): PostgREST upsert(onConflict: 'date,invite_id')가 조건 없이 추론하도록.
-- NULL끼리는 충돌하지 않으므로 teacher_id 쪽 행에는 영향이 없다.
alter table teacher_attendance
  add constraint teacher_attendance_date_invite_key unique (date, invite_id);

-- 2) 헬퍼: 출석 대상 초대(role='teacher')인지. teacher_invites는 관리자만 select 가능하므로 security definer.
create or replace function is_attendance_invite(target_invite_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_invites where id = target_invite_id and role = 'teacher'
  )
$$;
revoke execute on function is_attendance_invite(uuid) from public, anon;
grant execute on function is_attendance_invite(uuid) to authenticated;

-- 3) RLS 쓰기 검증: 활성 교사 행이거나 교사 초대 행이어야 한다(관리자·목사님 행, 그 외 초대는 거부).
drop policy teacher_attendance_write on teacher_attendance;
create policy teacher_attendance_write on teacher_attendance for all
  using (current_role_name() is not null)
  with check (
    current_role_name() is not null
    and (
      (teacher_id is not null and is_attendance_teacher(teacher_id))
      or (invite_id is not null and is_attendance_invite(invite_id))
    )
  );

-- 4) 첫 로그인 시 초대의 출석 기록을 새 teacher_id로 옮긴다. 초대 삭제(cascade)보다 먼저 실행해야 기록이 사라지지 않는다.
create or replace function claim_teacher_invite() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite teacher_invites%rowtype;
begin
  if v_uid is null then
    return false;
  end if;
  if exists (select 1 from teachers where id = v_uid) then
    return false;
  end if;

  -- 이메일 확인이 끝난 계정만 인정한다(구글 로그인은 확인된 이메일을 준다).
  select lower(email) into v_email
  from auth.users
  where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    return false;
  end if;

  select * into v_invite from teacher_invites where lower(email) = v_email for update;
  if not found then
    return false;
  end if;

  insert into teachers (id, email, name, role)
  values (v_uid, v_email, v_invite.name, v_invite.role);

  insert into teacher_classes (teacher_id, class_id)
  select v_uid, class_id from teacher_invite_classes where invite_id = v_invite.id;

  update teacher_attendance
  set teacher_id = v_uid, invite_id = null
  where invite_id = v_invite.id;

  delete from teacher_invites where id = v_invite.id; -- teacher_invite_classes는 cascade
  return true;
end;
$$;

revoke all on function claim_teacher_invite() from public, anon;
grant execute on function claim_teacher_invite() to authenticated;

-- 5) 출석 대상 명단: 활성 교사 + 교사 초대(role='teacher'). 반환 타입이 바뀌므로 drop 후 create.
-- 초대 쪽은 이름과 담당 반만 내려주고 이메일은 내려주지 않는다.
drop function if exists list_attendance_teachers();
create function list_attendance_teachers()
returns table (id uuid, name text, class_names text[], is_pending boolean)
language sql stable security definer set search_path = public as $$
  select
    t.id,
    t.name,
    coalesce(array_agg(c.name order by c.name) filter (where c.id is not null), '{}'),
    false
  from teachers t
  left join teacher_classes tc on tc.teacher_id = t.id
  left join classes c on c.id = tc.class_id and c.is_active
  where current_role_name() is not null
    and t.role = 'teacher'
    and t.is_active
  group by t.id, t.name
  union all
  select
    i.id,
    i.name,
    coalesce(array_agg(c.name order by c.name) filter (where c.id is not null), '{}'),
    true
  from teacher_invites i
  left join teacher_invite_classes ic on ic.invite_id = i.id
  left join classes c on c.id = ic.class_id and c.is_active
  where current_role_name() is not null
    and i.role = 'teacher'
  group by i.id, i.name
$$;

revoke execute on function list_attendance_teachers() from public, anon;
grant execute on function list_attendance_teachers() to authenticated;
