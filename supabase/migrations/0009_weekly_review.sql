-- 반별 주간 총평 · 목사님 답글 (docs/screens/weekly-review.md).
-- 총평은 반·주당 1건, 공동 작성이다(그 반 접근 권한이 있는 교사·관리자 누구나 이어 쓰거나 고칠 수 있음).
-- 답글은 목사님만 작성하고(can_access_class가 목사님을 제외하므로 총평 자체는 쓸 수 없음), 시간순으로 쌓인다.

create table class_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  week_start date not null check (extract(dow from week_start) = 0), -- 항상 일요일
  class_id uuid not null references classes(id),
  body text not null default '' check (char_length(body) <= 3000),
  recorded_by uuid not null references teachers(id),
  recorded_at timestamptz not null default now(),
  last_modified_by uuid not null references teachers(id),
  last_modified_at timestamptz not null default now(),
  unique (week_start, class_id)
);

create table class_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references class_weekly_reviews(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_by uuid not null references teachers(id),
  created_at timestamptz not null default now()
);
create index class_review_replies_review_idx on class_review_replies (review_id, created_at);

-- 감사 필드 트리거(0004/0008과 같은 패턴): 최초 입력자만 recorded_*로 남기고 last_modified_at은 서버 시각으로 강제.
create or replace function class_weekly_reviews_set_audit_fields() returns trigger
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

create trigger class_weekly_reviews_set_audit_fields_trigger
  before insert or update on class_weekly_reviews
  for each row execute function class_weekly_reviews_set_audit_fields();

-- RLS. 총평: 목사님은 조회만(can_access_class에서 제외되므로 쓰기 정책을 통과 못함). 교사·관리자는
-- can_access_class 기준(teachers_can_view_all 스위치·담당 반 반영, students/attendance와 동일 규칙).
alter table class_weekly_reviews enable row level security;
alter table class_review_replies enable row level security;

create policy class_weekly_reviews_select on class_weekly_reviews for select
  using (can_access_class(class_id) or is_pastor());
create policy class_weekly_reviews_write on class_weekly_reviews for all
  using (can_access_class(class_id)) with check (can_access_class(class_id));

-- 답글: 조회는 부모 총평의 반 기준으로 동일 규칙. 작성은 목사님만(본인 id로). 삭제는 본인 답글만
-- (수정 정책은 두지 않는다 — student_notes와 달리 수정 UI 자체가 없음).
create policy class_review_replies_select on class_review_replies for select
  using (
    exists (
      select 1 from class_weekly_reviews r
      where r.id = class_review_replies.review_id
        and (can_access_class(r.class_id) or is_pastor())
    )
  );
create policy class_review_replies_insert on class_review_replies for insert
  with check (current_role_name() = 'pastor' and created_by = auth.uid());
create policy class_review_replies_delete on class_review_replies for delete
  using (created_by = auth.uid());

-- GRANT (0002의 설명 참고 — 클라우드는 기본 GRANT가 있고 로컬 `supabase start`에는 없다).
-- class_weekly_reviews는 행을 지우지 않으므로(답글이 FK로 걸려 있어 유실 방지) delete는 주지 않는다.
grant select, insert, update on class_weekly_reviews to authenticated;
grant select, insert, delete on class_review_replies to authenticated;

-- 총평 마지막 수정자·답글 작성자 이름 조회용. teachers는 본인·관리자만 select 가능해서(teachers_select_self),
-- 다른 사람이 쓴 총평/답글의 작성자 이름을 일반 교사·목사님이 읽으려면 security definer 함수가 필요하다
-- (list_attendance_teachers, 0008과 같은 이유). id/이름만 내려주고 이메일 등은 노출하지 않는다.
create or replace function list_teacher_names(ids uuid[])
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name
  from teachers t
  where current_role_name() is not null and t.id = any(ids)
$$;

revoke execute on function list_teacher_names(uuid[]) from public, anon;
grant execute on function list_teacher_names(uuid[]) to authenticated;
