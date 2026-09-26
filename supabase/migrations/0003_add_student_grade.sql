-- students에 학년(중1~고3) 컬럼 추가. 상세 설명은 docs/data-model-guide.md 참고.
-- 기존 행의 학년은 알 수 없으므로 nullable로 추가한다 — 배포 후 관리자가 학생 마스터에서 채워 넣는다.

alter table students add column grade text
  check (grade in ('중1', '중2', '중3', '고1', '고2', '고3'));
