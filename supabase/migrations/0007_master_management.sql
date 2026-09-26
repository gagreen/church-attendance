-- 마스터 관리(설정) 화면 지원: docs/screens/master-management.md
--   1) app_settings.show_late_button  — 상태 버튼의 `지각` 표시 여부(표시 전용)
--   2) teacher_invites / teacher_invite_classes — 아직 로그인하지 않은 신규 교사 초대 대기열
--   3) claim_teacher_invite() — 초대받은 사람의 첫 로그인 시 초대를 teachers/teacher_classes로 옮기는 함수
--   4) teachers 마지막 활성 관리자 보호 트리거
--   5) classes.name 중복 방지

-- 1) 지각 버튼 표시. 기존 app_settings_select/app_settings_update 정책이 그대로 적용된다.
alter table app_settings add column show_late_button boolean not null default true;

-- 2) 초대 대기열
create table teacher_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  role text not null check (role in ('admin', 'teacher', 'pastor')),
  invited_by uuid not null references teachers(id),
  invited_at timestamptz not null default now()
);
-- 이메일은 대소문자 무관하게 유일해야 한다(구글 로그인 이메일과 대조할 때 lower()로 비교).
create unique index teacher_invites_email_key on teacher_invites (lower(email));

create table teacher_invite_classes (
  invite_id uuid not null references teacher_invites(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  primary key (invite_id, class_id)
);

alter table teacher_invites enable row level security;
alter table teacher_invite_classes enable row level security;

-- teachers/teacher_classes와 동일한 패턴: 관리자만 관리.
create policy teacher_invites_admin on teacher_invites for all
  using (is_admin()) with check (is_admin());
create policy teacher_invite_classes_admin on teacher_invite_classes for all
  using (is_admin()) with check (is_admin());

-- 2-1) GRANT (0002의 설명 참고 — 클라우드는 기본 GRANT가 있고 로컬 `supabase start`에는 없다).
-- 마스터 화면에서 담당 반 교체(teacher_classes)와 초대 취소(teacher_invites)는 행 삭제가 필요하다.
-- 어떤 행을 지울 수 있는지는 위 RLS 정책(관리자 전용)이 결정한다.
grant select, insert, update, delete on teacher_invites, teacher_invite_classes to authenticated;
grant delete on teacher_classes to authenticated;

-- 3) 초대 수락. 로그인한 사용자의 auth.users 이메일과 일치하는 초대가 있으면 teachers 행을 만들고
-- 초대에 지정된 담당 반을 옮긴 뒤 초대를 지운다. 반환값: 초대를 수락했으면 true.
--
-- security definer인 이유: 이 시점의 사용자는 아직 teachers에 없어 RLS(is_admin() 등)로는 어떤 쓰기도
-- 할 수 없다. 대신 함수 안에서 "본인(auth.uid())의 인증된 이메일과 일치하는 초대 1건"만 처리하도록 좁혀 둔다.
-- 이미 teachers에 있는 사용자(비활성 포함)는 건드리지 않는다 — 비활성 교사가 초대로 되살아나는 것을 막는다.
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

  delete from teacher_invites where id = v_invite.id; -- teacher_invite_classes는 cascade
  return true;
end;
$$;

revoke all on function claim_teacher_invite() from public, anon;
grant execute on function claim_teacher_invite() to authenticated;

-- 4) 마지막 활성 관리자 보호: 활성 관리자가 0명이 되면 아무도 마스터 관리 화면에 들어갈 수 없다.
-- 앱의 화면/Server Action 가드와 별개로 DB가 직접 막는다(Studio에서 고치는 경우 포함).
create or replace function teachers_guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.is_active
     and not (new.role = 'admin' and new.is_active)
     and not exists (
       select 1 from teachers where role = 'admin' and is_active and id <> old.id
     ) then
    raise exception 'last_active_admin' using errcode = 'P0001',
      hint = '활성 관리자는 최소 1명이 있어야 합니다.';
  end if;
  return new;
end;
$$;

create trigger teachers_guard_last_admin_trigger
  before update of role, is_active on teachers
  for each row execute function teachers_guard_last_admin();

-- 5) 반 이름 중복 방지(비활성 반 포함). 앞뒤 공백/대소문자만 다른 이름도 같은 이름으로 본다.
create unique index classes_name_key on classes (lower(btrim(name)));
