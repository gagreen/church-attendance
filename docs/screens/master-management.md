# 화면 설계 — 마스터 관리 (교사 · 학생 · 반)

[CLAUDE.md](../../CLAUDE.md) 로드맵 P3 "교사·학생 마스터 관리 화면" 상세 설계. 반(classes) 마스터 관리도 이 화면에 함께 포함한다(원래 로드맵엔 빠져 있었으나, 별도 화면을 새로 만들기보다 같은 관리자 화면 안에 탭으로 묶는 것이 합리적이라고 판단). 상단 내비게이션(☰) 메뉴에서 관리자에게만 보이는 "마스터 관리" 항목으로 진입한다.

## 화면 목적 & 권한

교사·학생·반 마스터 데이터를 관리자가 직접 등록/수정/비활성화한다. **이 화면 전체는 `role='admin'`만 접근한다** — 메뉴 자체를 관리자가 아니면 렌더링하지 않고, `teachers_write`/`students_write`/`classes_write`/`app_settings_update` RLS 정책이 DB 레벨에서도 동일하게 막아준다(이중 방어).

## 레이아웃

```
┌─────────────────────────────────────┐
│ ☰  마스터 관리                        │
│ [교사]  학생  반                      │  ← 탭
├─────────────────────────────────────┤
│ 박교사  park@gmail.com  교사  활성 ▾   │
│  담당 반: 중등부, 초등2부  [수정]       │
│ 김목사  pastor@gmail.com  목사님 활성▾ │
├─────────────────────────────────────┤
│ 초대 대기 중                          │
│ lee@gmail.com  교사  (담당: 유치부)    │
│  아직 로그인 안 함           [초대 취소]│
├─────────────────────────────────────┤
│ + 새 교사 등록                        │
├─────────────────────────────────────┤
│ 전역 설정                             │
│ 교사 전체보기 허용        [켜짐 ▾]      │  ← app_settings.teachers_can_view_all
└─────────────────────────────────────┘
```

## 교사 탭

### 목록

- 활성/비활성 교사 목록: 이름, 이메일, 역할(`admin`/`teacher`/`pastor`), 활성 여부 토글, 담당 반(교사 역할일 때만, `teacher_classes` 조인) + 수정 버튼.
- 활성 토글은 `is_active`를 바로 끄고 켜는 것 — 삭제(delete)는 쓰지 않는다(감사 추적 보존, 기존 "delete 안 쓴다" 원칙).

### 신규 교사 등록 — 초대(pending) 방식

`teachers.id`가 `auth.users(id)`를 참조하는 `not null` FK라서, 그 사람이 구글 로그인을 최소 한 번 시도해 `auth.users`에 id가 생기기 전에는 `teachers` row를 만들 수 없다. 그래서 "이메일만 먼저 등록 → 로그인 시 자동 활성화"하는 초대 흐름을 둔다.

**필요한 스키마 변경(신규 마이그레이션 필요, 아직 작성 안 됨)**

```sql
-- teacher_invites: 아직 로그인하지 않은 신규 교사 초대 대기열
create table teacher_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'teacher', 'pastor')),
  invited_by uuid not null references teachers(id),
  invited_at timestamptz not null default now()
);

-- teacher_invite_classes: 초대 시점에 미리 지정해두는 담당 반 (teacher_classes와 동일한 모양)
create table teacher_invite_classes (
  invite_id uuid not null references teacher_invites(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  primary key (invite_id, class_id)
);
```

- RLS: `teacher_invites`/`teacher_invite_classes` 모두 `is_admin()`만 select/insert/delete 가능하도록 `teachers`/`teacher_classes`와 동일한 패턴의 정책을 추가한다.

**흐름**

1. 관리자가 "새 교사 등록" 폼에서 이메일 · 이름 · 역할 · (교사라면) 담당 반을 입력 → `inviteTeacher()` 액션이 `teacher_invites` + `teacher_invite_classes`에 insert.
2. 초대받은 사람이 구글 로그인을 시도하면, 기존 OAuth 콜백(`app/auth/callback/route.ts`, 이미 구현됨)의 화이트리스트 검사 로직에 아래 단계가 추가로 필요하다:
   - `teachers`에 이 `auth.users.id`가 이미 있으면 기존과 동일하게 통과.
   - 없으면 로그인한 이메일로 `teacher_invites`를 조회. 매칭되는 초대가 있으면 트랜잭션으로 `teachers`에 새 row를 만들고(`id`=방금 로그인한 `auth.users.id`, 나머지는 초대 정보로 채움, `is_active=true`), `teacher_invite_classes` 내용을 `teacher_classes`로 옮기고, 해당 `teacher_invites` row를 삭제한다.
   - 매칭되는 초대도 없으면 기존과 동일하게 접근 차단.
   - 이 로직 변경은 별도 구현 작업(콜백 코드 수정 + 마이그레이션 적용)으로 진행하고, 이 화면 자체의 프론트 작업과는 분리해서 다룬다.
3. 아직 로그인하지 않은 초대는 "초대 대기 중" 섹션에 별도로 보여주고, 관리자가 "초대 취소"로 `teacher_invites`에서 삭제할 수 있다.

### 데이터 계약

`app/actions/teachers.ts`

```ts
type InviteTeacherParams = {
  email: string;
  name: string;
  role: "admin" | "teacher" | "pastor";
  classIds: string[];
};
type CancelInviteParams = { inviteId: string };
type UpdateTeacherParams = {
  teacherId: string;
  isActive?: boolean;
  classIds?: string[];
};
type SetTeachersCanViewAllParams = { value: boolean };
```

## 학생 탭

교사와 달리 학생은 로그인 주체가 아니므로(auth 연동 없음) 초대 흐름이 필요 없다 — 관리자가 바로 등록한다.

- 목록: 이름, 반, 학년, 활성 여부, 등록일(`enrolled_date`).
- 신규 등록: 이름 · 반 · 학년(선택, 미지정 가능) · 등록일(기본값 오늘) 입력 → `students` insert.
- 수정: 반 이동(`class_id` 변경 — [data-model-guide.md](../data-model-guide.md#반-이동-처리)대로 과거 `attendance.class_id`는 건드리지 않음), 학년 변경, 활성/비활성 토글.

### 데이터 계약

`app/actions/students.ts` (기존 파일에 추가)

```ts
type CreateStudentParams = {
  name: string;
  classId: string;
  grade?: "중1" | "중2" | "중3" | "고1" | "고2" | "고3";
  enrolledDate?: string;
};
type UpdateStudentParams = {
  studentId: string;
  classId?: string;
  grade?: string | null;
  isActive?: boolean;
};
```

## 반 탭 (신규 추가 — 원래 로드맵엔 없었음)

- 목록: 이름, 활성 여부, 소속 학생 수, 담당 교사 목록(`teacher_classes` 조인).
- 신규 등록: 이름만 입력 → `classes` insert.
- 이름 수정, 활성/비활성 토글(soft delete — 기존에 배정된 학생/출석 기록은 그대로 유지되고 반 선택 드롭다운에서만 숨겨짐).

### 데이터 계약

`app/actions/classes.ts` (신규 파일)

```ts
type CreateClassParams = { name: string };
type UpdateClassParams = { classId: string; name?: string; isActive?: boolean };
```

## 전역 설정

- `app_settings.teachers_can_view_all` 토글 — 교사 탭 하단(또는 화면 최하단)에 배치. 관리자만 변경 가능(`app_settings_update` RLS).
- 변경 시 `updated_by`/`updated_at` 갱신.

## 에러/로딩 상태

- 모든 등록/수정 액션은 실패 시 토스트로 에러 표시, 폼 값 유지(재시도 가능하도록) — 실패 처리 없이 호출하지 않는다는 공통 원칙.
- 이메일 중복 초대, 반 이름 중복 등 DB unique 제약 위반은 사용자에게 이해 가능한 메시지로 변환해서 보여준다(원본 Postgres 에러 노출 금지).

## 이 화면에서 다루지 않는 것 (범위 밖)

- 교사가 학생/반 마스터 데이터를 직접 등록하는 권한 — [CLAUDE.md](../../CLAUDE.md) 특이사항에 "미정"으로 남아 있음, 이 화면은 관리자 전용으로만 설계했다. 나중에 교사 권한이 열리면 화면 재검토 필요.
- 교사 역할 자체를 `admin`으로 바꾸는 것과 `is_active` 토글은 있지만, "관리자가 자기 자신을 비활성화"하는 등의 예외 케이스 가드는 구현 단계에서 별도로 챙긴다(마지막 활성 관리자가 0명이 되는 상황 방지 등).
