# 화면 설계 — 통계

[CLAUDE.md](../../CLAUDE.md) 화면 흐름의 "통계" 단계 상세 설계 (P3 범위). 상단 내비게이션(☰) 메뉴의 "통계" 항목으로 진입하는 독립 화면이다.

> **(설계 중)** 통계 탭의 기본 화면은 반별 출석·코멘트·주간 총평을 모아 보는 `주별` 뷰로 바뀌고, 이 문서의 월간 통계는 `월별` 서브 탭이 된다 — [weekly-review.md](weekly-review.md). 이 문서의 월별 동작·출석률 정의는 그대로 유지된다.

## 화면 목적

반별/학생별 월간 출석 현황을 집계해서 보여주고, 통계 리포트를 엑셀로 내보낸다. 그날그날의 입력은 [출석 입력 화면](attendance-input.md), 개별 학생 이력은 [학생 상세 화면](student-detail.md)이 담당하고, 이 화면은 "집계"만 다룬다.

## 레이아웃

```
┌─────────────────────────────────────┐
│ ☰  전체 ▾        2026년 9월 ▾        │  ← 반 선택 + 월 선택
├─────────────────────────────────────┤
│ 반별 요약                             │
│ 중등부   출석률 92%  (기록 23/25)      │
│ 초등2부  출석률 88%  (기록 22/25)      │
│ 유치부   출석률 95%  (기록 19/20)      │
├─────────────────────────────────────┤
│ 학생별 상세 — 중등부                   │  ← 반을 하나 선택하면 펼쳐짐
│ 김민수   출석 4 · 지각 0 · 결석 0 · 공예배 0 · 100% │
│ 이서연   출석 3 · 지각 1 · 결석 0 · 공예배 0 · 100% │  ← 이름 탭 → 학생 상세
├─────────────────────────────────────┤
│              [엑셀로 내보내기]        │
└─────────────────────────────────────┘
```

- 반 선택이 `전체`면 반별 요약만 보여준다. 특정 반을 고르면 그 아래 학생별 상세가 펼쳐진다(탭 전환보다 자연스러운 드릴다운). 반별 요약은 반을 골라도 접근 가능한 전체 반을 그대로 보여주고(반 간 비교 유지), 선택된 반 행만 강조한다. 요약 행을 탭해도 그 반이 선택되고(다시 탭하면 `전체`), 상단 반 선택기와 동일하게 동작한다.
- 월 선택은 ‹ › 버튼으로 한 달씩 이동한다(이번 달보다 미래로는 이동 불가). 상단 내비게이션은 ☰ 메뉴 대신 헤더의 "출석 / 통계" 링크로 구현했다([components/AppHeader.tsx](../../components/AppHeader.tsx)) — 마스터 관리 화면 추가 시 항목만 늘리면 된다.
- 월 선택: 연-월 피커, 기본값 이번 달.
- 조회 권한: 관리자/교사(접근 가능한 반 범위)/목사님 모두 가능. 권한 모델 문서에서 "통계"가 관리자 항목에만 명시돼 있지만, 조회 성격상 기존 `can_access_class`/`is_pastor()` RLS 범위를 그대로 따르는 것으로 해석해 구현했다 — 교사·목사님도 자신이 조회 가능한 반의 통계는 볼 수 있다. (이 해석은 아직 사용자 확인 전이다. 관리자 전용으로 바꾸려면 `class_month_stats`/`student_month_stats`의 조건과 화면 진입만 조정하면 된다.)

## 출석률 정의 (중요 — 반드시 이 정의를 그대로 구현할 것)

- **분자**: `출석` + `지각` + `공예배` 로 기록된 횟수 (즉 명시적으로 `결석`이 아닌 모든 기록).
- **분모**: 그 달에 **실제로 저장된 전체 `attendance` 레코드 수** (출석+지각+결석+공예배 합). 미체크(레코드 없음)는 분자·분모 어디에도 포함하지 않는다.
- 이 정의는 [학생 상세 화면](student-detail.md#출석-이력-attendance)에서 "미체크는 실제 기록이 아니므로 이력/합계에 포함하지 않는다"고 정한 원칙과 통계 화면에서도 일관되게 유지한 것이다. 출석 입력 화면의 "미체크=결석으로 시각적 인지" 장치는 그 화면 UI에서만 쓰는 신호이고, 실제 DB 집계(통계·엑셀 리포트)에는 반영하지 않는다 — 교사가 입력을 안 한 것과 실제로 결석한 것을 통계에서 섞으면 감사 신뢰도가 떨어지기 때문이다.
- 그 달에 기록이 0건이면 출석률은 0%가 아니라 `null`(화면엔 "기록 없음", 엑셀엔 `-`)이다 — "전원 결석"과 "입력 안 함"을 구분하기 위함이다. 출석률은 소수점 없이 반올림한 정수(%)다.
- 대신 통계가 "얼마나 신뢰할 만한 숫자인지" 가늠할 수 있도록, 반별 요약 행에 `기록 23/25`처럼 **그 반의 그 달 이론상 전체 슬롯(학생 수 × 그 달 일요일 수) 대비 실제 기록된 수**를 작게 병기한다. 입력이 덜 된 반은 출석률이 아니라 이 숫자가 낮게 나오므로, 두 신호가 구분되어 보인다.

## 데이터 계약

`app/actions/statistics.ts` → `getClassStatistics`
```ts
type GetClassStatisticsParams = { classId: string | 'all'; month: string }; // month: YYYY-MM

type ClassStatRow = {
  classId: string;
  className: string;
  recordedCount: number;   // 실제 기록된 attendance 행 수
  expectedSlots: number;   // 학생 수 x 그 달 일요일 수 (커버리지 표시용)
  presentRate: number | null; // 0~100 정수, 위 정의대로 계산. 기록 0건이면 null
  counts: { 출석: number; 지각: number; 결석: number; 공예배: number };
};

type StudentStatRow = {
  studentId: string;
  studentName: string;
  recordedCount: number;
  presentRate: number | null;
  counts: { 출석: number; 지각: number; 결석: number; 공예배: number };
};

type ClassStatisticsResult = {
  classes: ClassStatRow[];
  students: StudentStatRow[] | null; // classId가 'all'이 아닐 때만 채워짐 (학년 내림차순 → 이름순)
};
```

- `classes`는 `classId`와 무관하게 접근 가능한 활성 반 전체다. `students`는 그 반의 현재 활성 학생이며, 기록은 그 반(`attendance.class_id`)에서 쌓인 것만 센다.
- 반별 요약도 `attendance.class_id`(기록 당시 반) 기준이라, 반을 옮긴 학생의 과거 기록은 옛 반 통계에 남는다. `expectedSlots`는 현재 활성 학생 수 기준이므로, 그 달 도중 비활성화된 학생의 기록이 있으면 `recordedCount`가 `expectedSlots`를 넘을 수 있다. 또 이번 달은 아직 오지 않은 일요일도 슬롯에 포함되어 월초에는 기록 수가 낮게 보인다(설계 문서의 "그 달 일요일 수" 정의를 그대로 따름).

- 집계는 Postgres 함수 `class_month_stats(p_month)` / `student_month_stats(p_class_id, p_month)`(`supabase/migrations/0006_statistics_functions.sql`, `security invoker`라 RLS 그대로 적용)에서 계산하고 Next.js는 결과 행을 그대로 받아 렌더링만 한다 — 집계 로직을 클라이언트나 Server Action에 중복 구현하지 않는다([data-model-guide.md](../data-model-guide.md#엑셀-내보내기-쿼리-가이드)의 원칙과 동일). 호출부는 `lib/db/statistics.ts`다.

## 엑셀 내보내기

현재 선택된 반(또는 전체)·월 기준으로 `ClassStatisticsResult`를 그대로 `.xlsx`로 변환한다. Route Handler(`GET /statistics/export?classId=&month=`, [app/statistics/export/route.ts](../../app/statistics/export/route.ts))에서 `lib/xlsx.ts`의 공통 헬퍼로만 생성하며, 화면과 같은 조회 함수(`getClassStatisticsResult`)를 써서 숫자가 어긋나지 않게 한다. 시트는 "반별 요약"과(특정 반 선택 시) "학생별 {반}" 두 개다.

## 이 화면에서 다루지 않는 것 (범위 밖)

- 학기/연도 단위 집계 전환, 반 간 비교 그래프 등 — 현재 스코프는 "월 단위, 숫자 테이블"까지.
- 개별 학생의 상세 이력 목록 — [학생 상세 화면](student-detail.md)으로 드릴다운해서 본다.
