-- 로컬 개발용 시드 데이터: 반 6개 · 학생 20명 · 테스트 교사 5명(관리자 1 · 교사 3 · 목사님 1).
-- `supabase db reset` 시 migrations 적용 후 자동 실행된다 (supabase/config.toml [db.seed]).
-- 프로덕션 Supabase 프로젝트에는 절대 실행하지 않는다 — 로컬(`supabase start`) 전용 더미 데이터다.
--
-- teachers.id는 auth.users(id)를 참조하므로, 실제 로그인 없이 화이트리스트를 시드하려면
-- auth.users에도 대응하는 더미 행을 먼저 넣어야 한다(FK 제약 충족 목적). 이 더미 계정은
-- 실제 Google 로그인과는 무관하다 — 진짜 로그인 검증은 docs/auth-setup.md대로 실제 Google
-- 계정을 등록해서 확인한다.

-- 1) 테스트 교사용 auth.users 더미 행
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111101', 'authenticated', 'authenticated', 'admin@example.com',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"name":"관리자"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111102', 'authenticated', 'authenticated', 'teacher1@example.com', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"name":"김교사"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111103', 'authenticated', 'authenticated', 'teacher2@example.com', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"name":"이교사"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111104', 'authenticated', 'authenticated', 'teacher3@example.com', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"name":"박교사"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111105', 'authenticated', 'authenticated', 'pastor@example.com',  '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"name":"최목사"}', '', '', '', '')
on conflict (id) do nothing;

-- 2) teachers 화이트리스트
insert into teachers (id, email, name, role) values
  ('11111111-1111-1111-1111-111111111101', 'admin@example.com',    '관리자', 'admin'),
  ('11111111-1111-1111-1111-111111111102', 'teacher1@example.com', '김교사', 'teacher'),
  ('11111111-1111-1111-1111-111111111103', 'teacher2@example.com', '이교사', 'teacher'),
  ('11111111-1111-1111-1111-111111111104', 'teacher3@example.com', '박교사', 'teacher'),
  ('11111111-1111-1111-1111-111111111105', 'pastor@example.com',   '최목사', 'pastor')
on conflict (id) do nothing;

-- 3) classes: 반 6개 (중등부 학년별)
insert into classes (id, name) values
  ('22222222-2222-2222-2222-222222222201', '1'),
  ('22222222-2222-2222-2222-222222222202', '2'),
  ('22222222-2222-2222-2222-222222222203', '3'),
  ('22222222-2222-2222-2222-222222222204', '4'),
  ('22222222-2222-2222-2222-222222222205', '5'),
  ('22222222-2222-2222-2222-222222222206', '6')
on conflict (id) do nothing;

-- 4) teacher_classes: teachers_can_view_all이 false로 꺼졌을 때를 테스트할 수 있도록
--    교사 3명에게 반을 2개씩 나눠 담당시킨다 (관리자·목사님은 매핑 불필요 — 전체 접근/전체 조회).
insert into teacher_classes (teacher_id, class_id)
select t.id, c.id from teachers t, classes c
where (t.email, c.name) in (
  ('teacher1@example.com', '1'), ('teacher1@example.com', '2'),
  ('teacher2@example.com', '3'), ('teacher2@example.com', '4'),
  ('teacher3@example.com', '5'), ('teacher3@example.com', '6')
)
on conflict do nothing;

-- 5) students: 학생 20명 (반별 4/4/3/3/3/3명, 반 이름과 같은 학년으로 채움)
insert into students (name, class_id, grade)
select v.name, c.id, v.grade
from (values
  ('김민준', '1', '중1'), ('이서연', '1', '중1'), ('박도윤', '1', '중1'), ('최지우', '1', '중1'),
  ('정하은', '2', '중2'), ('강주원', '2', '중2'), ('조서아', '2', '중2'), ('윤도현', '2', '중2'),
  ('장하윤', '3', '중3'), ('임예준', '3', '중3'), ('한소율', '3', '중3'),
  ('오은우', '4', '고1'), ('서지안', '4', '고1'), ('신현우', '4', '고1'),
  ('권다은', '5', '고2'), ('황민서', '5', '고2'), ('안준서', '5', '고2'),
  ('송서준', '6', '고3'), ('전예은', '6', '고3'), ('홍시우', '6', '고3')
) as v(name, class_name, grade)
join classes c on c.name = v.class_name;
