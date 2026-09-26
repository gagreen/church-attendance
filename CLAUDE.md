# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에게 프로젝트 맥락을 제공한다.
데이터 모델 상세: [docs/data-model-guide.md](docs/data-model-guide.md).

## 프로젝트 개요

교회 주일학교용 출석 관리 웹앱. 반 6개 · 학생 20명 · 교사 6~8명 규모, 비상업적(교회 내부용) 운영.
**운영비 0원**이 설계의 최우선 제약이며, Next.js(App Router, TypeScript) + Supabase(Postgres, Auth) + Vercel 조합으로 각 서비스의 무료 티어만으로 구축한다.

현재 상태: Next.js + Supabase + Vercel, 앱 대부분이 구현되어 있다. Supabase 프로젝트(리전 `ap-northeast-2`)는 생성·연결되어 있고 GitHub(`gagreen/church-attendance`) 저장소로 관리한다.

- **구현 완료**: 로그인(Google OAuth·콜백·화이트리스트, 설정 절차 [docs/auth-setup.md](docs/auth-setup.md)), 출석 입력 화면(`/`), 학생 상세(`/students/[id]`), 통계(`/statistics`)와 통계 엑셀 내보내기(`/statistics/export`), 교사 전체 조회 스위치.
- **마스터 관리(설정) 화면 구현 완료**: `/settings`(관리자 전용, 상단 메뉴의 "설정") — 교사·학생·반 탭, 교사 초대(첫 로그인 시 자동 활성화), 전역 설정(`teachers_can_view_all`, `show_late_button`). 마이그레이션 `0007`이 필요하다. 설계: [docs/screens/master-management.md](docs/screens/master-management.md).
- **교사 출석 구현 완료**: 출석 입력 화면(`/`)의 `학생 | 교사` 탭에서 교사(`role='teacher'`) 출석을 기록한다. 마이그레이션 `0008`이 필요하다. 설계: [docs/screens/teacher-attendance.md](docs/screens/teacher-attendance.md).
- **아직 안 된 것**: 출석 기록 원본 엑셀 내보내기(통계 리포트만 구현됨), 교사 출석의 통계·엑셀·이력 화면, Vercel 배포 연결(`.vercel` 없음), 마이그레이션 `0007`·`0008`의 프로덕션 적용(`supabase db push`; `0001`~`0006`은 적용됨), `0008` 적용 후 `lib/database.types.ts` 재생성(현재 `teacher_attendance` 타입은 수기 추가분).

이 문서와 `docs/data-model-guide.md`, `docs/screens/*.md`가 앞으로 작성될 모든 코드가 따라야 할 확정 사양이다.

이 제약(운영비 0원, 비상업적 무료 티어 내 운영)을 어기는 방향(유료 플랜 필수, 별도 유료 서버 등)으로 자의적으로 확장하지 말 것.

## 아키텍처

```
교사 브라우저 (모바일 · PC, 반응형)
  → Google 계정으로 로그인 (Supabase Auth의 Google OAuth)
Next.js App (Vercel 배포, App Router)
  → Server Actions / Route Handler에서 로그인 사용자 이메일 확인
  → Supabase `teachers` 테이블 화이트리스트 대조 후 접근 허용/차단
  → 권한 판단 (관리자 / 교사) — Supabase RLS 정책으로 DB 레벨에서도 강제
Supabase Postgres (관리형 DB)
  → 단일 소스. 교사는 앱을 통해서만 접근 (Supabase Studio 직접 편집 금지)
```

- 별도 Node/Express 서버, 별도 인프라, 외부 유료 API 키 관리가 필요한 구조는 이 프로젝트의 설계 원칙과 충돌한다. Next.js의 Server Actions/Route Handler로 서버 로직을 대체하고, DB·인증은 Supabase가 관리형으로 제공하는 것만 사용한다.
- Vercel Hobby(무료) 플랜은 비상업적 프로젝트로 한정되는데, 이 프로젝트는 교회 내부용 비상업적 도구이므로 조건에 부합한다.
- Supabase 무료 프로젝트는 약 1주일 이상 요청이 없으면 일시정지(pause)되고 다음 요청 시 자동으로 깨어난다(첫 응답만 수 초 지연). 매일 쓰이는 앱 특성상 실사용에서 체감될 가능성은 낮지만, 오래 방치되는 방학 기간 등에는 첫 접속이 느릴 수 있다는 점을 인지하고 있을 것.
- Supabase 무료 티어(500MB DB, 월 5만 MAU 등)는 이 프로젝트 규모(반 6·학생 20·교사 6~8)에 압도적으로 여유롭다. 쿼터를 크게 소모하는 설계를 걱정할 규모가 아니다.

## 개발 환경 설정

- 로컬 개발은 Node.js + Next.js 개발 서버(Next.js 16, React 19, Tailwind 4)를 쓴다. Next.js 16은 기존 지식과 다른 점이 있으므로(예: `middleware.ts` 대신 `proxy.ts`) 코드를 쓰기 전 `AGENTS.md`의 안내대로 `node_modules/next/dist/docs/`를 확인한다.
- 이미 셋업된 저장소를 처음 받았을 때: `npm install` → `.env.local.example`을 `.env.local`로 복사해 Supabase 대시보드(Project Settings → API) 값을 채움 → `supabase login` → `supabase link --project-ref <project-ref>` → `npm run dev`. 값이 비어 있으면 `proxy.ts`가 모든 요청에서 에러를 낸다(의도된 동작).
- 로그인 동작 확인에는 Google Cloud OAuth 클라이언트 발급과 Supabase의 Google 프로바이더·Redirect URL 등록이 필요하다 — [docs/auth-setup.md](docs/auth-setup.md)를 따른다. 스키마 초기 세팅 순서는 `docs/data-model-guide.md`의 "Supabase 초기 세팅 체크리스트"를 따른다.
- 배포(미완료)는 Vercel 프로젝트를 만들고 GitHub 저장소를 Import한 뒤 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)를 등록하고, 프로덕션 도메인을 Supabase Redirect URLs에 추가한다.
- 로컬 DB는 Supabase CLI의 로컬 환경(`supabase start`, Docker 필요)을 쓴다. `supabase db reset`을 하면 마이그레이션 적용 후 `supabase/seed.sql`이 자동 실행된다 — 반 6개·학생 20명·테스트 교사 5명(관리자 1·교사 3·목사님 1)의 **로컬 전용 더미 데이터**이며 프로덕션에는 절대 실행하지 않는다.
- Supabase의 `project-ref`, API 키 등 프로젝트별 민감정보는 `.env.local`에만 두고 `.gitignore`에 포함해 커밋하지 않는다. 대신 `.env.local.example`을 키 이름만 채운 템플릿으로 커밋해 둔다. `supabase/.temp`(link 캐시)도 커밋하지 않는다.
- 로컬 저장소에는 앱 코드(`app/`, `lib/`, `components/`)와 `supabase/migrations/*.sql`(스키마 버전 관리), `docs/`만 존재한다. 실제 DB 데이터와 Auth 사용자 목록은 Supabase 클라우드 프로젝트에 있다.

## 자주 쓰는 명령어

```bash
npm run dev                 # Next.js 로컬 개발 서버
npm run build               # 프로덕션 빌드 (타입 체크 포함)
npm run lint                # ESLint
npm test                    # Vitest 유닛 테스트 1회 실행 (lib/ 순수 로직)
npx tsc --noEmit            # 타입 체크만
supabase start              # 로컬 Supabase(Docker) 실행 — DB/Auth 로컬 테스트용
supabase db reset           # 로컬 DB를 마이그레이션 + seed.sql로 초기화 (로컬 전용)
supabase migration list     # 로컬/원격 마이그레이션 적용 현황 비교
supabase db push            # 미적용 마이그레이션을 연결된 원격 프로젝트에 적용 (DB 비밀번호 필요)
supabase gen types typescript --linked > lib/database.types.ts   # 스키마 변경 후 타입 재생성
```

배포 연결 후에는 `main` 브랜치 push 시 Vercel이 자동 배포하므로 수동 `vercel deploy`는 예외적으로만 쓴다.

## 테스트 방법

- 순수 로직(날짜 계산, 입력 검증, 엑셀 생성, 파라미터 파싱 등)은 `lib/`에 일반 함수로 분리하고 같은 위치에 `*.test.ts`로 Vitest 유닛 테스트를 둔다(현재 `lib/date`, `lib/redirect`, `lib/masterValidation`, `lib/statisticsParams`, `lib/xlsx`, `lib/db/students`, `lib/db/teacherAttendance` 테스트가 있다). 화면·Server Action·RLS 정책에는 자동화 테스트가 없다.
- DB를 다루는 로직은 `supabase start`로 띄운 로컬 Postgres(`supabase db reset`으로 시드 적용)에 대해 실행하며 검증한다. 프로덕션 Supabase 프로젝트에 직접 테스트하지 않는다.
- 마이그레이션·RLS 변경 시에는 시드의 관리자/교사/목사님 계정으로 각각 조회·쓰기가 의도대로 되는지 확인한다(권한은 계정별로 결과가 달라진다).
- UI 변경은 로컬 개발 서버(또는 배포 연결 후 Vercel Preview Deployment)에서 반응형(모바일 폭 포함) 동작을 직접 확인한다.

## 데이터 모델 — Supabase Postgres

기존 Google Sheet의 세로형(long format) 구조를 그대로 관계형 테이블로 옮긴다: "학생 행 × 날짜 행"이 쌓이는 `attendance` 테이블 중심 설계를 유지하되, FK 제약조건으로 정합성을 DB가 강제하도록 한다.

테이블 생성 SQL, 컬럼별 타입·제약조건, RLS 정책, 반 이동 처리 등 실무 디테일은 **[docs/data-model-guide.md](docs/data-model-guide.md)**에 정리되어 있다. 스키마를 다루는 작업을 할 때는 이 문서를 먼저 확인한다.

| 테이블               | 역할                                                              | 주요 컬럼                                                                                                     |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `classes`            | 반 마스터                                                         | id, name, is_active, created_at                                                                               |
| `students`           | 학생 마스터                                                       | id, name, class_id, enrolled_date, is_active, grade (중1~고3, nullable)                                       |
| `attendance`         | 출석 기록 (1행 = 1명×1일)                                         | id, date, class_id, student_id, status, comment, recorded_by, recorded_at, last_modified_by, last_modified_at |
| `student_notes`      | 학생 프로필 메모 (날짜 무관, 지속 특이사항)                       | id, student_id, note, created_by, created_at                                                                  |
| `teachers`           | 교사 마스터 · 로그인 화이트리스트                                 | id (auth.users.id), email, name, role, is_active                                                              |
| `teacher_classes`    | 교사 ↔ 반 매핑 (다대다)                                           | teacher_id, class_id                                                                                          |
| `teacher_attendance` | 교사 출석 기록 (1행 = 1교사×1일, 학생 `attendance`와 별도 테이블) | id, date, teacher_id, status, comment, recorded_by, recorded_at, last_modified_by, last_modified_at           |
| `app_settings`       | 전역 설정 (단일 행)                                               | id (항상 true), teachers_can_view_all, updated_by, updated_at                                                 |

- **출석 상태**는 출석 / 지각 / 결석 / 공예배 4종으로 고정 (Postgres `check` 제약조건으로 강제).
- **코멘트는 2종을 구분해서 유지**한다: `attendance.comment`(당일 사유, 예: 지각 이유)와 `student_notes`(지속적 특이사항, 예: 알레르기). 이 둘을 하나로 합치지 않는다.
- 기존 Sheet 버전에서 쓰던 `c01`/`s014`/`a1042`/`n003` 같은 커스텀 ID 코드는 더 이상 쓰지 않는다 — Postgres가 `uuid`(또는 `bigint identity`) 기본키를 자동 생성해주므로, 시트 시절 필요했던 수동 채번 로직 자체가 사라진다. 이것이 관계형 DB 전환으로 얻는 유지보수 이득 중 하나다.
- `classes.teacher_name` 같은 담당 교사 표시용 중복 컬럼은 두지 않는다 — `teacher_classes` 조인으로 담당 교사를 구하면 되므로, 데이터 중복과 갱신 누락 위험을 원천적으로 없앤다.
- `attendance`는 여전히 자체 `class_id`를 갖는다 — 학생이 반을 옮겨도 과거 출석 기록은 "그 당시 속했던 반" 기준으로 남아야 하기 때문에, `students.class_id`(현재 반)와 별개로 유지한다.
- `attendance`는 10개 컬럼이다 — `last_modified_by`/`last_modified_at`을 반드시 포함한다(아래 권한 모델 항목 참고).

## 권한 모델

- **관리자** (복수 가능): 전체 반·학생 조회/통계, 교사·학생 마스터 관리, 모든 기록 수정 가능. `app_settings.teachers_can_view_all` 스위치도 관리자만 바꾼다.
- **교사**: 기본(`teachers_can_view_all = true`)으로는 모든 반·학생을 조회하고 출석을 입력·수정할 수 있다(학생 전체보기 포함). 관리자가 스위치를 끄면 `teacher_classes`에 매핑된 담당 반만 가능하다. 스위치는 전체 교사 일괄 적용이며 교사별 개별 설정은 없다. 읽기·쓰기 권한은 분리하지 않는다. `student_notes`와 `attendance.comment`도 같은 범위로 공개된다.
- **목사님** (`role='pastor'`, `teachers` 테이블에 등록): 모든 학생의 출석·코멘트·메모를 **조회/수정** 할 수 있다.
- **교사 출석**: 관리 대상은 활성 `role='teacher'`뿐이고, 로그인한 활성 사용자 전원(교사·관리자·목사님)이 어떤 교사의 출석이든 입력·수정·조회할 수 있다(본인 체크인과 대리 입력을 구분하지 않음). 반에 종속되지 않으므로 `teachers_can_view_all`·`can_access_class`와 무관하며, 대상 검증은 RLS(`is_attendance_teacher`)가 한다. 교사 명단은 `teachers`가 본인·관리자만 조회 가능해 `list_attendance_teachers()`(security definer)로만 읽는다.
- 로그인 사용자가 `teachers` 테이블에 없으면 접근 차단 (화이트리스트 방식, 자체 회원가입 없음). Supabase Auth 자체는 Google 계정이면 누구나 로그인에 성공할 수 있으므로, 반드시 애플리케이션 레벨(및 RLS 정책)에서 `teachers.is_active` 여부를 확인해 차단한다.
- 권한은 애플리케이션 코드뿐 아니라 **Supabase RLS(Row Level Security) 정책으로 DB 레벨에서도 이중으로 강제**한다 — Server Action에서의 권한 체크가 누락되더라도 DB가 잘못된 접근을 막아주는 것이 Postgres 전환의 핵심 이점이다.
- **과거 기록 수정에 잠금이 없다** — 모든 교사가 지난 날짜 기록을 자유롭게 수정할 수 있는 것이 확정된 설계다. 이를 막는 잠금/승인 로직을 임의로 추가하지 않는다. 대신 감사 추적을 위해 `attendance`에 `last_modified_by`/`last_modified_at` 컬럼을 둔다 — 최초 입력 시 `recorded_*`와 동일값, 이후 수정 시에만 갱신.
- 동시 편집(두 교사가 같은 날짜·같은 반을 동시에 저장) 경합은 Postgres의 트랜잭션과 `(date, student_id)` unique 제약조건 + `upsert(on conflict)`로 처리한다. Apps Script 시절의 `LockService` 같은 수동 락이 더 이상 필요 없다 — DB가 원자성을 보장해준다.

## 화면 흐름

로그인(Google 계정) → 출석 입력(반/날짜 선택은 별도 화면 없이 이 화면 상단 컨텍스트 바에서 처리 — 교사는 담당 반만, 관리자는 전체+필터, 날짜 기본값은 이번 주 일요일. 학생 리스트 + 상태 버튼 + 당일 코멘트. 상단 `학생 | 교사` 탭으로 교사 출석도 같은 화면에서 입력 — [docs/screens/teacher-attendance.md](docs/screens/teacher-attendance.md). 상세 설계: [docs/screens/attendance-input.md](docs/screens/attendance-input.md)) → 학생 상세(출석 이력 + 프로필 메모, 상세 설계: [docs/screens/student-detail.md](docs/screens/student-detail.md). 반별/학생별 월간 통계는 별도로 P3에서 다룬다)

엑셀 내보내기는 별도 화면이 아니라 각 조회 화면(출석 입력 목록, 통계)에 "엑셀로 내보내기" 버튼으로 곁들인다 — 서버(Route Handler)에서 `exceljs`로 `.xlsx`를 생성해 다운로드시킨다 (SheetJS `xlsx`는 npm 배포판에 미패치 취약점이 있어 사용하지 않는다).

## 코드 스타일

- 디렉터리는 기능 단위로 나눈다: `app/`(라우트·페이지·Server Actions), `lib/db/`(Supabase 쿼리 헬퍼, 테이블별 파일 분리 — `classes.ts`/`students.ts`/`attendance.ts` 등), `lib/auth.ts`(로그인·권한 판단), `lib/xlsx.ts`(엑셀 생성 헬퍼), `components/`(화면 단위 UI 컴포넌트), `supabase/migrations/`(스키마 SQL).
- DB I/O는 `lib/db/`의 쿼리 헬퍼로만 하고, 페이지/컴포넌트/Server Action에서 Supabase 클라이언트를 직접 호출해 임의 쿼리를 짜지 않는다 (기존 `SheetService.gs` 원칙을 그대로 계승).
- 클라이언트에서 직접 호출되는 서버 로직은 Next.js Server Actions(`'use server'`)로 작성하고, `app/actions/` 아래 화면 단위 파일로 분리한다(예: `app/actions/attendance.ts`의 `getAttendanceView`, `saveAttendance`). 내부 헬퍼는 `lib/db/`에 두고 export하지 않는 함수로 캡슐화해 클라이언트에서 호출 불가능하게 한다 — 기존 `api_`/`_` 접두사 구분을 TypeScript의 모듈 경계로 대체한다.
- 서버 함수는 화면별로 필요한 최소 데이터만 반환한다(풀 테이블 전송 지양) — 예: 출석 입력 화면 조회 함수는 학생별 `id`/`name`/`status`만 내려주고, `recorded_by` 같은 내부 감사 필드는 노출하지 않는다.
- TypeScript strict 모드를 사용하고, DB 스키마 타입은 Supabase CLI의 `supabase gen types typescript`로 생성해 `lib/database.types.ts`에 두고 수동으로 고치지 않는다(스키마 변경 시 재생성).
- 반응형 UI는 Tailwind CSS로 구현한다 (모바일 우선, PC는 넓은 화면 대응).
- 클라이언트 ↔ 서버 통신은 Server Actions 또는 `fetch`(Route Handler 호출) 어느 쪽이든, 실패 시 사용자에게 에러를 보여주는 처리를 항상 함께 작성한다 — 실패 처리 없이 호출하지 않는다.

## 저장소 규칙

- 커밋/브랜치 전략은 아직 정해지지 않음 — 첫 커밋 전에 사용자에게 확인한다.
- `docs/data-model-guide.md`와 이 CLAUDE.md는 기능 변경 시 함께 갱신 대상인지 확인하고, 확정된 설계를 코드가 벗어나면 둘 중 하나가 최신화되어야 한다.
- `supabase/migrations/*.sql`은 스키마 변경의 단일 소스다 — Supabase Studio에서 직접 테이블을 고치고 마이그레이션 파일에 반영하지 않는 방식은 지양한다(드리프트 방지).

## 개발 우선순위 (로드맵)

작업 순서나 범위가 불명확할 때 이 우선순위를 따른다.

1. **P1 — 핵심 출석 기능**: 로그인·권한, 반별 출석 입력/저장, 반별 필터, 과거 날짜 수정
2. **P2 — 코멘트 · 학생 상세**: 당일 코멘트, `student_notes`, 학생 상세 화면
3. **P3 — 통계 · 관리 · 내보내기**: 반별/학생별 월간 출석률(상세 설계: [docs/screens/statistics.md](docs/screens/statistics.md)), 교사·학생·반 마스터 관리 화면(상세 설계: [docs/screens/master-management.md](docs/screens/master-management.md)), 엑셀 내보내기(출석 기록 원본 + 통계 리포트) — 엑셀 내보내기는 원래 P1이었으나 P3 화면들과 함께 한 번에 설계하기로 변경. 반 마스터 관리는 원래 로드맵엔 없었으나 교사·학생 마스터 관리 화면에 탭으로 함께 포함하기로 추가.

P3 범위(통계, 마스터 관리 UI)를 P1 작업 중에 먼저 구현하려 하지 말 것 — 순서를 건너뛰어야 할 이유가 있다면 먼저 확인한다.

## 특이사항 · 주의할 점

- Google OAuth를 쓰려면 Google Cloud Console에서 OAuth 클라이언트를 만들고 Supabase Auth 설정(Providers → Google)에 연결해야 한다. 리디렉션 URL은 로컬 개발용과 Vercel 프로덕션용을 모두 등록해야 한다.
- Vercel Hobby 플랜은 비상업적 프로젝트 전용이다 — 이 프로젝트는 교회 내부용 비상업적 도구이므로 문제 없지만, 향후 유료 서비스화 등으로 성격이 바뀌면 재검토가 필요하다.
- Supabase 무료 프로젝트는 장기간(약 1주일+) 미사용 시 일시정지된다는 점을 감안해, 방학 등 장기간 앱을 안 쓰는 기간이 생기면 첫 접속이 느릴 수 있음을 인지하고 있을 것.
- RLS 정책을 잘못 설정하면 "테이블은 있는데 아무것도 안 보이는" 문제가 흔하다 — 정책 추가/변경 시 반드시 교사 계정과 관리자 계정 양쪽으로 실제 조회/쓰기를 확인한다.
- 학부모 알림(문자/카카오) 도입 여부 — 대부분 유료 API라 "운영비 0원" 원칙과 직접 충돌하는 결정이므로 별도 승인 없이 구현하지 않는다.
- 학기/연도 단위로 데이터를 분리할지(예: `classes`에 학기 컬럼 추가), 단일 테이블에 계속 누적할지 — 미정.
- 교사가 학생·반 마스터 데이터를 직접 등록할 수 있는지, 관리자만 가능한지 — 미정.

## 참고

- 이전 Google Apps Script + Google Sheet 기반 설계 및 기획 원문(Draft v0.3, 2026-08-31, [Artifact 링크](https://claude.ai/code/artifact/01de7a18-2482-4174-8556-725b04958d75))은 현재 스택과 다르므로 참고용으로만 남겨둔다. 화면 흐름·권한 모델의 취지는 이어받았지만 아키텍처·데이터 모델 세부는 이 문서가 최신이다.
