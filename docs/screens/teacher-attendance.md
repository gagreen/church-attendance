# 화면 설계 — 교사 출석

[출석 입력 화면](attendance-input.md)에 `학생 | 교사` 탭을 추가해 **교사 본인들의 주일 출석**도 기록·조회한다. 이 문서는 학생 출석 설계와 **다른 점만** 적는다 — 적히지 않은 동작(날짜 이동, 낙관적 UI, 미체크 틴트, 요약 바, 에러/로딩 상태, 잠금 없음)은 학생 탭과 동일하게 구현한다. 여기 없는 결정을 임의로 추가하지 않는다.

## 확정된 결정

| 항목 | 결정 |
| --- | --- |
| 대상 | `teachers.role = 'teacher'` 이고 `is_active = true` 인 사람만. 관리자·목사님은 출석 관리 대상이 아니다. |
| 기록 주체 | **로그인한 활성 사용자 전원**(교사·관리자·목사님)이 어떤 교사의 출석이든 입력·수정할 수 있다. 본인 체크인과 대리 입력을 구분하지 않는다. |
| 상태 | 학생과 같은 4종(출석/지각/결석/공예배). 별도 상태를 만들지 않는다. |
| 화면 | 출석 입력 화면(`/`)의 상단 탭. 별도 메뉴·라우트 없음. |
| 통계·엑셀·상세 | **이번 범위 밖**(아래 "다음 단계 후보"). |

## 권한 모델 — 기존 규칙과 달라지는 점

- **목사님도 이 탭에서는 쓰기 가능**하다. CLAUDE.md의 "목사님 = 조회 전용"은 학생·출석·메모 데이터에 대한 규칙이며, `teacher_attendance`만 예외다. 그래서 목사님 계정은 **학생 탭은 읽기 전용, 교사 탭은 입력 가능**이 되므로 UI에서 읽기 전용 여부를 탭 단위로 판단해야 한다(화면 전체 단위 플래그를 재사용하면 안 된다).
- 교사 출석은 반에 종속되지 않으므로 `teachers_can_view_all` 스위치·`can_access_class`의 영향을 받지 않는다. 활성 사용자면 누구나 전체 교사를 조회·입력한다.
- 과거 날짜 수정 잠금 없음, 감사 필드(`recorded_*`, `last_modified_*`)로 추적 — 학생 출석과 동일 원칙.

## 데이터 모델 — `0008_teacher_attendance.sql`

```sql
create table teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  teacher_id uuid not null references teachers(id),  -- 출석 대상 교사
  status text not null check (status in ('출석', '지각', '결석', '공예배')),
  comment text,
  recorded_by uuid not null references teachers(id),
  recorded_at timestamptz not null default now(),
  last_modified_by uuid not null references teachers(id),
  last_modified_at timestamptz not null default now(),
  unique (date, teacher_id)
);
create index teacher_attendance_teacher_date_idx on teacher_attendance (teacher_id, date desc);
```

- `attendance`에 섞지 않고 **별도 테이블**로 둔다. `attendance`는 `student_id`·`class_id` not null이고 RLS·통계 함수(`class_month_stats` 등)가 학생 기준이라, 억지로 합치면 기존 통계 숫자가 오염된다.
- `class_id`를 두지 않는다. 교사는 여러 반을 맡을 수 있고(다대다), "그 당시 담당 반"을 남길 실익이 없다.
- 감사 트리거는 [0004](../../supabase/migrations/0004_attendance_audit_trigger.sql)와 같은 패턴으로 만든다(`recorded_*` 보존, `last_modified_*` 갱신).

### RLS

```sql
alter table teacher_attendance enable row level security;

-- 조회·쓰기 모두 활성 사용자 전원. 쓰기는 대상이 활성 role='teacher'인 행만 허용.
create policy teacher_attendance_select on teacher_attendance for select
  using (current_role_name() is not null);
create policy teacher_attendance_write on teacher_attendance for all
  using (current_role_name() is not null)
  with check (current_role_name() is not null and is_attendance_teacher(teacher_id));
```

`is_attendance_teacher(uuid)`는 활성 `role='teacher'` 여부를 판단하는 `security definer` 헬퍼다. `teachers`가 본인·관리자만 select 가능해서, 정책 안에서 `exists (select ... from teachers)`로 직접 조회하면 일반 교사·목사님에게는 다른 교사 행이 보이지 않아 항상 거부된다.

- 대상 검증을 RLS `with check`에 둔 이유: Server Action 검증이 누락돼도 관리자·목사님 행이 저장되지 않게 하기 위함(CLAUDE.md의 이중 강제 원칙).
- `teachers` 테이블은 본인·관리자만 select 가능하므로, **교사 명단 조회는 RLS 우회 없이는 안 된다** — `security definer` 함수 `list_attendance_teachers()`(0008)가 활성 `role='teacher'`의 `id`, `name`, 담당 반 이름만 반환해 노출한다. 이메일 등 다른 컬럼은 내려주지 않는다.

## 화면

```
┌─────────────────────────────────────┐
│ ☰            2026.09.27(일) ▾        │  ← 컨텍스트 바 (교사 탭: 반 드롭다운 숨김)
├─────────────────────────────────────┤
│ [ 학생 ]  [ 교사 ]                    │  ← 탭
├─────────────────────────────────────┤
│ 출석 5 · 지각 1 · 결석 1 · 공예배 0   │
├─────────────────────────────────────┤
│ 김선생   중등부, 초등2부              │
│ [출석][지각][결석][공예배]        💬  │
│ 박선생   유치부                       │
│ [출석][지각][결석][공예배]        💬  │
└─────────────────────────────────────┘
```

- **탭 전환**: 날짜는 두 탭이 공유한다(탭을 바꿔도 같은 주일). 탭 선택은 `localStorage`에 기억(기본 `학생`).
- **반 드롭다운**: 교사 탭에서는 숨긴다. 교사가 6~8명이라 필터가 불필요하다. 학생 탭으로 돌아가면 기존 반 선택이 그대로 복원된다.
- **정렬**: 이름 가나다순 단일 리스트(학년 개념 없음). 각 행에 담당 반 이름을 작은 태그로 병기하고, 담당 반이 없으면 `담당 반 없음`.
- **행 구성·상태 버튼·💬 코멘트·요약 바·미체크 틴트·지각 버튼 숨김 설정(`show_late_button`)·저장 방식(탭마다 즉시 저장하지 않고 일괄 저장, [attendance-input.md#저장](attendance-input.md#저장-탭마다-즉시-저장하지-않고-일괄-저장한다api-호출-절약))·`출석 종료` 버튼**: 학생 탭과 동일. 이름은 탭해도 이동하지 않는다(교사 상세 화면 없음).
- **요약 바**: 현재 탭 기준 집계. 교사 탭에서는 교사 명단 기준이다.
- **읽기 전용 아님**: 목사님도 버튼이 활성화된다(위 권한 모델). 그 외 사용자도 본인 행과 타인 행을 구분해 표시하지 않는다.

## 데이터 계약 — `app/actions/teacherAttendance.ts`

```ts
type TeacherAttendanceRow = {
  teacherId: string;
  teacherName: string;
  classNames: string[];                                 // 담당 반, 이름순
  status: '출석' | '지각' | '결석' | '공예배' | null;     // null = 미체크
  comment: string | null;
};

type TeacherAttendanceBatchEntry = {
  teacherId: string;
  status: '출석' | '지각' | '결석' | '공예배';
  comment: string | null;
};

getTeacherAttendanceView({ date }): TeacherAttendanceRow[]            // 활성 role='teacher', 이름순
saveTeacherAttendanceBatch({ date, entries: TeacherAttendanceBatchEntry[] })       // 일반 플러시
closeTeacherAttendanceAsAbsent({ date, teacherIds, entries: TeacherAttendanceBatchEntry[] })  // 출석 종료
```

- 탭/코멘트는 즉시 저장하지 않고 로컬 버퍼에 쌓았다가 일괄 저장한다 — 트리거·`sendBeacon` 엔드포인트(`app/api/attendance/flush`, `kind: 'teacher'`)·실패 시 처리 방식은 전부 학생 탭과 동일하다([attendance-input.md#저장](attendance-input.md#저장-탭마다-즉시-저장하지-않고-일괄-저장한다api-호출-절약) 참고).
- DB I/O는 `lib/db/teacherAttendance.ts` 헬퍼로만 한다. upsert는 `onConflict: 'date,teacher_id'`, 감사 필드 보존 규칙은 학생 출석과 동일.
- 감사 필드는 화면에 내려주지 않는다.

## 엣지 케이스

- **교사 비활성화·역할 변경**: 명단에서 사라지지만 과거 `teacher_attendance` 행은 그대로 남는다. 삭제하지 않는다.
- **역할이 admin/pastor로 바뀐 사람의 기존 행**: 보존하되, 새 입력은 RLS가 막는다.
- **초대만 되고 아직 로그인 안 한 교사**(`teacher_invites`): `teachers` 행이 없어 명단에 나오지 않는다. 첫 로그인 후부터 대상이 된다.
- **동시 입력**: `(date, teacher_id)` unique + upsert로 마지막 저장이 이긴다. 학생과 동일.
- **본인 미기록이 곧 결석은 아님**: 통계로 확장할 때도 학생과 같이 미체크는 분자·분모에서 제외하는 원칙([statistics.md](statistics.md#출석률-정의-중요--반드시-이-정의를-그대로-구현할-것))을 따른다.

## 이번 범위 밖 — 다음 단계 후보

1. 통계 화면에 교사 출석률 탭 + 엑셀 시트 추가 (`teacher_month_stats` 함수 신설, 기존 학생 통계 함수는 건드리지 않는다).
2. 교사별 출석 이력 화면.
3. 연속 결석 교사 강조 표시(외부 발송 없이 화면 표시만 — 무료 티어 원칙).

## 구현 순서 제안

1. `0008` 마이그레이션 + 명단 조회 함수 → 로컬 `supabase db reset` 후 **관리자·교사·목사님 계정 각각**으로 조회/쓰기, 관리자·목사님 행 저장 거부 확인.
2. `lib/db/teacherAttendance.ts` + 순수 로직 테스트(정렬·담당 반 병합).
3. Server Actions → 탭 UI(`AttendanceScreen`에 탭 추가, 읽기 전용 판단을 탭 단위로 분리).
4. 문서 갱신(아래).

## 구현 현황

구현 완료(2026-09-27): `0008` 마이그레이션, `lib/db/teacherAttendance.ts`, `app/actions/teacherAttendance.ts`, 탭 UI(`AttendanceScreen` 셸 + `StudentAttendancePanel`/`TeacherAttendancePanel`). 타입·린트·유닛 테스트만 통과했고 **DB·RLS·화면은 아직 실행 검증 전**이다(Docker 미실행). 위 "구현 순서 제안" 1번의 계정별 확인이 남아 있다.

## 함께 갱신한 문서

- [CLAUDE.md](../../CLAUDE.md): 데이터 모델 표에 `teacher_attendance` 추가, 권한 모델에 교사 출석 항목 추가, 화면 흐름에 교사 탭 언급.
- [data-model-guide.md](../data-model-guide.md): 스키마·RLS·인덱스·명단 조회 함수 추가.
- [attendance-input.md](attendance-input.md): 상단에 이 문서로의 링크와 탭 구조 한 줄.
