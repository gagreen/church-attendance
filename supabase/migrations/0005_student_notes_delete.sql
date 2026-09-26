-- 학생 프로필 메모(student_notes) 삭제 허용.
-- 0002에서는 delete를 앱에서 쓰지 않는다는 전제로 GRANT하지 않았지만, 잘못 쓴 메모를 지울 수 있어야 한다는
-- 요구로 student_notes에 한해 delete를 허용한다. 어떤 행을 지울 수 있는지는 기존 RLS 정책
-- student_notes_write(for all — 학생이 속한 반 접근 권한 기준, 목사님 제외)가 그대로 결정한다.
-- (Supabase 클라우드는 기본 GRANT로 이미 delete가 열려 있고, 로컬 `supabase start` 환경에만 필요하다.)
grant delete on student_notes to authenticated;
