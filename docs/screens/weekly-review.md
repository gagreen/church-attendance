# 화면 설계 — 반별 주간 총평 · 주별 모아보기

신규 기능 두 가지의 설계다. 구현 전 설계 단계이며, **"확정"으로 표시한 것만 결정 사항**이고 "제안"으로 표시한 것은 대화로 조정할 수 있다. 여기 없는 결정을 임의로 추가하지 않는다.

1. **반별 주간 총평** — 교사가 그 주의 공과·반모임 후기/공유사항을 반 단위로 적는다. 위치는 [출석 입력 화면](attendance-input.md) 학생 탭의 맨 아래.
2. **주별 모아보기** — [통계 화면](statistics.md)의 기본 뷰. 반별로 그 주의 출석, 출석 코멘트, 총평을 모아 보여주고, 목사님이 반별 총평에 답글을 단다.

## 확정된 결정

| 항목 | 결정 |
| --- | --- |
| 총평 단위 | **반·주당 1건, 공동 작성.** 그 반 접근 권한이 있는 교사·관리자 누구나 이어 쓰거나 고칠 수 있고, 마지막 수정자만 기록한다. |
| 답글 | **목사님만 작성**, 한 총평에 여러 개가 시간순으로 쌓인다. 교사·관리자는 읽기만 한다(재답글 없음). |
| 모아보기 출석 정보 | 상태별 **숫자 + 결석·지각자 이름 + 코멘트가 달린 학생의 코멘트**. |
| 총평 저장 | **자동 저장**(코멘트 입력과 같은 방식). 저장 버튼 없음. |
| 통계 탭 기본 화면 | 주별 모아보기. 기존 월간 통계는 `월별` 서브 탭으로 유지한다. |

## 용어 — "주"의 기준

- 주는 **일요일 시작~토요일**이다. 총평의 키는 `week_start`(그 주의 일요일)다.
- 출석 화면에서 선택된 날짜가 무엇이든 같은 주면 같은 총평을 본다(평일 날짜를 열어도 그 주 총평이 보인다). `week_start` 계산은 [lib/date.ts](../../lib/date.ts)의 `sundayOfWeek`를 그대로 쓴다.

## 데이터 모델 — 신규 마이그레이션 `0009` (제안, 아직 작성 안 됨)

```sql
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
```

- 감사 필드(`recorded_*` 보존, `last_modified_*` 갱신)는 [0004](../../supabase/migrations/0004_attendance_audit_trigger.sql)와 같은 트리거 패턴으로 만든다. upsert는 `onConflict: 'week_start,class_id'`.
- **총평 행은 삭제하지 않는다**(delete 미부여). 내용을 지우면 빈 문자열로 남는다 — 답글이 FK로 걸려 있어 행이 사라지면 답글이 유실되기 때문이다. 화면은 빈 총평을 "총평 없음"으로 취급하고 답글 입력도 막는다.
- 답글은 수정 UI를 두지 않는다(`student_notes`와 같은 기조). 삭제 허용 여부는 아래 "열린 질문".

### RLS (제안)

| 대상 | 조회 | 쓰기 |
| --- | --- | --- |
| `class_weekly_reviews` | `can_access_class(class_id) or is_pastor()` | `can_access_class(class_id)` — 관리자·교사만. **목사님은 이 함수에서 제외**되므로 총평 작성 불가 |
| `class_review_replies` | 부모 총평의 반 기준으로 위와 동일 | insert: `current_role_name() = 'pastor'` 이고 `created_by = auth.uid()` |

- 총평 조회 범위는 학생 출석과 같은 규칙(`teachers_can_view_all` 스위치, 담당 반)을 따른다. 스위치를 끄면 교사는 담당 반의 총평·답글만 본다.
- 참고: [CLAUDE.md](../../CLAUDE.md) 권한 모델은 목사님을 "조회/수정"으로 적고 있으나 현재 마이그레이션(`0002`)의 RLS는 학생 데이터에 대해 조회 전용이다. 이 기능은 **DB 기준(총평 쓰기 불가, 답글만 가능)**으로 설계했다. 목사님이 총평도 고칠 수 있게 하려면 RLS와 이 표를 같이 바꿔야 한다.
- `supabase gen types typescript`로 `lib/database.types.ts`를 재생성한다.

## 화면 1 — 출석 입력 화면 하단의 총평

```
│ ...학생 리스트...                      │
├─────────────────────────────────────┤
│ 이번 주 총평 · 중등부                  │
│ 9.27(일) 주                           │
│ ┌───────────────────────────────┐   │
│ │ 공과: 로마서 8장 / 반모임: ...   │   │
│ └───────────────────────────────┘   │
│ 저장됨 · 마지막 수정 박교사 오전 11:20  │
│ ▸ 목사님 답글 2                        │  ← 펼치면 읽기 전용 목록
└─────────────────────────────────────┘
```

- **표시 조건**: `학생` 탭에서 반이 **하나 선택된 경우에만** 렌더링한다. `전체` 보기에서는 숨긴다(어느 반의 총평인지 모호해지고, 반이 여러 개면 입력창이 반 수만큼 늘어난다). `교사` 탭에서는 렌더링하지 않는다.
- **입력**: 여러 줄 텍스트 영역. 입력을 멈추고 약 800ms 뒤와 포커스를 잃을 때 저장한다(코멘트의 디바운스/blur 패턴 재사용). 저장 중/저장됨 표시는 작게, 실패는 눈에 띄게 + 낙관적 상태 유지 후 재시도 안내. placeholder는 "공과·반모임 후기나 공유사항을 적어주세요".
- **날짜/반을 바꾸면** 해당 (주, 반)의 총평을 다시 불러온다. 학생 리스트 조회와 **별도 요청**으로 불러 리스트 로딩을 막지 않는다. 아직 저장 대기 중인 입력이 있으면 전환 전에 먼저 저장한다.
- **읽기 전용**: 목사님은 총평을 읽기만 한다. 답글은 이 화면이 아니라 통계의 주별 모아보기에서 쓴다(이 화면에는 답글 목록만 읽기 전용으로 보여준다).
- **동시 편집**: 같은 반의 두 교사가 동시에 쓰면 마지막 저장이 이긴다(공동 작성 모델의 알려진 한계). 다른 사람이 수정한 뒤 화면을 다시 열면 최신본이 보이고, "마지막 수정 ○○" 표시로 인지할 수 있다. 낙관적 잠금(수정 시각 비교)은 이번 범위에 넣지 않는다.
- 글자 수 제한 3000자(위 `check`와 일치). 한도에 가까워지면 카운터를 표시한다.

## 화면 2 — 통계 > 주별 모아보기

```
┌─────────────────────────────────────┐
│ [ 주별 ]  월별                         │  ← 서브 탭 (기본 주별)
│ ‹   2026.9.27(일) 주   ›    전체 ▾    │  ← 주 이동 + 반 필터
├─────────────────────────────────────┤
│ 중등부                    기록 5/5명   │
│ 출석 4 · 지각 1 · 결석 0 · 공예배 0    │
│ 지각  이서연                           │
│ 코멘트                                 │
│  · 이서연 (지각) 병원 진료로 늦음        │
│ ── 총평 · 박교사 수정 ─────────────    │
│ 공과: 로마서 8장 / 반모임: ...         │
│ ── 목사님 답글 ────────────────────    │
│ 수고하셨습니다. 민수 심방 부탁드립니다.   │
│ 목사님 · 9.28 오후 3:10                │
│ [ 답글 쓰기 ]                          │  ← 목사님에게만 표시
├─────────────────────────────────────┤
│ 초등2부 ...                           │
```

- **진입**: 헤더의 `통계` 링크(`/statistics`)가 곧바로 주별 뷰를 연다. 월별은 서브 탭으로 이동(예: `/statistics?view=month`). 기존 월별 화면 동작·문서([statistics.md](statistics.md))는 바뀌지 않는다.
- **주 이동**: ‹ › 로 한 주씩. 기본값은 이번 주. 이번 주보다 미래로는 이동 불가(월별과 동일 규칙).
- **반 필터**: 기본 `전체`(접근 가능한 활성 반을 카드로 세로 나열, 반 이름순). 반을 고르면 그 반 카드 하나만 보인다.
- **반 카드 구성**(위에서 아래로)
  1. 헤더: 반 이름 + 커버리지 `기록 n/m명`(그 주에 출석이 기록된 학생 수 / 현재 활성 학생 수). 미체크는 집계에 넣지 않는다는 [통계 원칙](statistics.md#출석률-정의-중요--반드시-이-정의를-그대로-구현할-것)과 같은 이유로, 입력이 덜 된 반을 숫자로 구분해 준다.
  2. 상태별 숫자. `show_late_button`이 꺼져 있어도 그 주에 `지각` 기록이 있으면 숫자를 보여준다([master-management.md](master-management.md)의 요약 바 규칙과 동일).
  3. 결석자·지각자 이름(학년 내림차순 → 이름순). 없으면 그 줄을 생략한다.
  4. 코멘트: `attendance.comment`가 있는 기록만 `이름 (상태) 내용`으로 나열. 해당 기록의 날짜가 그 주 일요일이 아니면 날짜를 앞에 붙인다.
  5. 총평: 본문 + `박교사 수정` 표시. 없거나 비어 있으면 회색 "총평이 아직 없습니다".
  6. 목사님 답글: 시간순 목록.
  7. 답글 입력: **목사님에게만** 표시, **총평이 비어 있지 않을 때만** 활성. 여러 줄 입력 + `등록` 버튼(답글은 확정 발언이라 자동 저장하지 않고 명시적으로 등록한다).
- **출석률(%)은 표시하지 않는다.** 출석률의 정의와 노출은 월별 뷰의 몫이고, 주별 뷰는 숫자·이름·코멘트까지만 보여준다.
- 주 범위(일~토) 안에 같은 학생의 기록이 둘 이상이면(평일 보충 입력 등) 기록 수 기준으로 그대로 센다 — 월별 집계와 같은 원칙이며 드문 경우다.
- 읽기 전용 사용자(그 외 역할)는 답글 입력창 없이 읽기만 한다.

## 데이터 계약 (제안)

`app/actions/weeklyReview.ts`

```ts
type ClassReview = {
  reviewId: string | null;          // 아직 한 번도 저장 안 했으면 null
  body: string;
  lastModifiedByName: string | null;
  lastModifiedAt: string | null;
  replies: { id: string; body: string; authorName: string; createdAt: string; mine: boolean }[];
};

getClassReview({ classId, date }): ClassReview                  // 출석 화면용. week_start는 서버에서 계산
saveClassReview({ classId, date, body })                         // upsert(week_start, class_id)
getWeeklyOverview({ weekStart, classId: string | 'all' }): WeeklyOverview
addReviewReply({ reviewId, body })                               // 목사님만, 비어 있지 않은 총평에만
```

```ts
type WeeklyClassCard = {
  classId: string; className: string;
  recordedStudents: number; activeStudents: number;
  counts: { 출석: number; 지각: number; 결석: number; 공예배: number };
  absentNames: string[]; lateNames: string[];
  comments: { studentName: string; status: '출석'|'지각'|'결석'|'공예배'; date: string; comment: string }[];
  review: ClassReview | null;
};
type WeeklyOverview = { weekStart: string; cards: WeeklyClassCard[] };
```

- DB I/O는 `lib/db/weeklyReview.ts`(+ `lib/db/attendance.ts`의 주 범위 조회)로만 한다. 감사 필드·`recorded_by` 등 원본 ID는 화면에 내려주지 않는다. `mine`은 삭제 버튼 표시용 플래그다(삭제를 허용할 경우).
- 주별 뷰는 이름·코멘트까지 원본 행이 필요하므로, **`lib/` 순수 함수로 행을 집계**하고(정렬·커버리지·이름/코멘트 추출 — Vitest 테스트 대상) 월별처럼 별도 Postgres 함수를 만들지 않는다. 데이터가 반 6·학생 20 규모라 한 번에 불러도 부담이 없다.
- 모든 액션은 실패 시 사용자에게 에러를 보여주는 처리와 함께 작성한다(공통 원칙).

## 에러/로딩 상태

- 총평 로딩 실패: 텍스트 영역 대신 "총평을 불러오지 못했습니다 · 다시 시도". 학생 리스트는 그대로 사용 가능.
- 총평 저장 실패: 입력한 내용을 화면에 유지한 채 "저장 실패 · 다시 시도"를 표시한다(입력 유실 금지).
- 주별 뷰 로딩: 반 카드 스켈레톤. 조회 실패 시 재시도 버튼.
- 답글 등록 실패: 입력 내용 유지 + 토스트.

## 이번 범위 밖

- 주별 뷰 엑셀 내보내기, 교사 출석의 주별 모아보기 포함.
- 총평·답글 수정 이력, 읽음/안 읽음 추적, 외부 알림(문자·카카오·이메일 — 유료 API라 "운영비 0원" 원칙상 별도 승인 없이 넣지 않는다).
- 총평 검색·기간 목록 화면(과거 총평은 주 이동으로만 본다).

## 열린 질문 (대화로 정할 것)

1. **답글 삭제**: 목사님이 본인 답글을 삭제할 수 있게 할까요? (제안: 오타 대비로 본인 답글만 확인창을 거쳐 삭제 허용, 수정은 없음)
2. **"답글 대기" 표시**: 목사님이 한눈에 보도록, 총평은 있는데 답글이 없는 반 카드에 `답글 대기` 배지를 붙일까요? (화면 안 표시만, 알림 없음)
3. **교사에게 새 답글 알림**: 출석 화면 총평 옆에 `목사님 답글 n`만 보여주고 읽음 추적은 하지 않는 안(제안)으로 충분한가요? 안 읽은 답글에 점을 찍으려면 읽음 테이블이 추가로 필요합니다.
4. **총평 가이드 문구**: 빈 입력창에 "공과 / 반모임 / 기도제목" 같은 항목 힌트를 placeholder로 넣을까요, 자유 서식으로 둘까요?
5. **`전체` 보기에서 총평**: 출석 화면 `전체` 보기에서 총평을 숨기는 안(제안)이면 충분한가요, 아니면 반별로 접힌 총평 목록을 보여줄까요?
6. **글자 수 제한**: 총평 3000자 / 답글 2000자로 충분한가요?
