-- 월간 출석 통계 집계 함수 (docs/screens/statistics.md).
-- 집계는 앱 코드가 아니라 여기서만 계산한다 — Next.js는 결과 행을 그대로 렌더링/엑셀 변환만 한다.
--
-- security invoker(기본값을 명시): 호출자의 권한으로 실행되므로 attendance/students의 RLS가 그대로 적용된다.
-- 반 목록은 RLS만으로는 걸러지지 않는다(classes_select는 활성 교사 전체 허용) — teachers_can_view_all=false일 때
-- 담당하지 않는 반이 0건짜리 행으로 보이지 않도록 can_access_class/is_pastor로 직접 거른다.
--
-- 출석률 정의: (출석 + 지각 + 공예배) / 그 달 실제 저장된 전체 레코드 수. 미체크(레코드 없음)는 분자·분모
-- 어디에도 넣지 않는다. 레코드가 0건이면 출석률은 null(정의 불가)이다 — 0%와 구분하기 위함.
--
-- 집계 기준 반은 attendance.class_id(기록 당시 반)다. 학생이 반을 옮겨도 과거 기록은 그 당시 반의 통계에 남는다.

-- 반별 요약. expected_slots = 현재 활성 학생 수 x 그 달 일요일 수 (입력 커버리지 표시용).
create or replace function class_month_stats(p_month date)
returns table (
  class_id uuid,
  class_name text,
  recorded_count integer,
  expected_slots integer,
  present_count integer,
  late_count integer,
  absent_count integer,
  worship_count integer,
  present_rate integer
)
language sql stable security invoker set search_path = public as $$
  with bounds as (
    select
      date_trunc('month', p_month)::date as first_day,
      (date_trunc('month', p_month) + interval '1 month')::date as next_first_day
  ),
  sundays as (
    -- timestamp(시간대 없음)로 전개해야 세션 시간대와 무관하게 요일이 고정된다.
    select count(*)::integer as n
    from bounds b,
      generate_series(b.first_day::timestamp, (b.next_first_day - 1)::timestamp, interval '1 day') as d
    where extract(dow from d) = 0
  ),
  active_students as (
    select s.class_id, count(*)::integer as n
    from students s
    where s.is_active
    group by s.class_id
  ),
  agg as (
    select
      a.class_id,
      count(*)::integer as total,
      (count(*) filter (where a.status = '출석'))::integer as present,
      (count(*) filter (where a.status = '지각'))::integer as late,
      (count(*) filter (where a.status = '결석'))::integer as absent,
      (count(*) filter (where a.status = '공예배'))::integer as worship
    from attendance a, bounds b
    where a.date >= b.first_day and a.date < b.next_first_day
    group by a.class_id
  )
  select
    c.id,
    c.name,
    coalesce(agg.total, 0),
    coalesce(active_students.n, 0) * sundays.n,
    coalesce(agg.present, 0),
    coalesce(agg.late, 0),
    coalesce(agg.absent, 0),
    coalesce(agg.worship, 0),
    case
      when coalesce(agg.total, 0) = 0 then null
      else round(100.0 * (agg.present + agg.late + agg.worship) / agg.total)::integer
    end
  from classes c
  cross join sundays
  left join agg on agg.class_id = c.id
  left join active_students on active_students.class_id = c.id
  where c.is_active and (can_access_class(c.id) or is_pastor())
  order by c.name
$$;

-- 한 반의 학생별 상세. 현재 그 반의 활성 학생만 나열하고, 기록은 그 반(attendance.class_id)에서 쌓인 것만 센다.
-- 정렬(학년 내림차순 → 이름)은 앱의 sortStudents가 담당한다 — 그래서 grade를 함께 돌려준다.
create or replace function student_month_stats(p_class_id uuid, p_month date)
returns table (
  student_id uuid,
  student_name text,
  grade text,
  recorded_count integer,
  present_count integer,
  late_count integer,
  absent_count integer,
  worship_count integer,
  present_rate integer
)
language sql stable security invoker set search_path = public as $$
  with bounds as (
    select
      date_trunc('month', p_month)::date as first_day,
      (date_trunc('month', p_month) + interval '1 month')::date as next_first_day
  ),
  agg as (
    select
      a.student_id,
      count(*)::integer as total,
      (count(*) filter (where a.status = '출석'))::integer as present,
      (count(*) filter (where a.status = '지각'))::integer as late,
      (count(*) filter (where a.status = '결석'))::integer as absent,
      (count(*) filter (where a.status = '공예배'))::integer as worship
    from attendance a, bounds b
    where a.class_id = p_class_id
      and a.date >= b.first_day and a.date < b.next_first_day
    group by a.student_id
  )
  select
    s.id,
    s.name,
    s.grade,
    coalesce(agg.total, 0),
    coalesce(agg.present, 0),
    coalesce(agg.late, 0),
    coalesce(agg.absent, 0),
    coalesce(agg.worship, 0),
    case
      when coalesce(agg.total, 0) = 0 then null
      else round(100.0 * (agg.present + agg.late + agg.worship) / agg.total)::integer
    end
  from students s
  left join agg on agg.student_id = s.id
  where s.class_id = p_class_id
    and s.is_active
    and (can_access_class(p_class_id) or is_pastor())
$$;

-- 함수 실행은 기본적으로 public에 열려 있어 별도 GRANT가 필요 없다. 다만 anon이 호출할 이유가 없으므로 회수한다.
revoke execute on function class_month_stats(date) from public, anon;
revoke execute on function student_month_stats(uuid, date) from public, anon;
grant execute on function class_month_stats(date) to authenticated;
grant execute on function student_month_stats(uuid, date) to authenticated;
