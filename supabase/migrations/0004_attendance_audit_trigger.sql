-- 출석 저장은 앱에서 upsert(onConflict: 'date,student_id')로만 호출한다(docs/screens/attendance-input.md).
-- PostgREST의 upsert는 요청 JSON에 포함된 컬럼만 INSERT/UPDATE 대상이 되므로, status/comment는 상태 버튼과
-- 코멘트 저장이 각각 자기 컬럼만 보내면 자연히 나머지 컬럼이 보존된다(coalesce 효과). 다만 recorded_by는
-- INSERT 시 not null이라 매 요청에 함께 보내야 하는데, 그러면 conflict(update) 때도 SET 대상에 포함되어
-- 매번 현재 교사로 덮어써 버린다 — "최초 입력자만 recorded_by로 남는다"는 감사 추적 요구사항과 충돌한다.
-- 그래서 update일 때만 recorded_by/recorded_at을 이전 값으로 강제 복원하는 트리거로 보완한다.
-- last_modified_at은 클라이언트 시계를 신뢰하지 않기 위해 매번 서버 시각(now())으로 강제한다.
create or replace function attendance_set_audit_fields() returns trigger
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

create trigger attendance_set_audit_fields_trigger
  before insert or update on attendance
  for each row execute function attendance_set_audit_fields();
