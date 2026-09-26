'use client';

import { useEffect, useRef, useState } from 'react';
import type { AttendanceInitialContext } from '@/app/actions/attendance';
import { loadStoredContext, saveStoredContext, type AttendanceTab } from '@/lib/attendanceStorage';
import { ClassPicker } from './ClassPicker';
import { DatePicker } from './DatePicker';
import { StudentAttendancePanel } from './StudentAttendancePanel';
import { TeacherAttendancePanel } from './TeacherAttendancePanel';

const TABS: { value: AttendanceTab; label: string }[] = [
  { value: 'student', label: '학생' },
  { value: 'teacher', label: '교사' },
];

// 출석 입력 화면 셸: 탭(학생 | 교사)·날짜·반 선택을 갖고 탭별 패널을 그린다. 날짜는 두 탭이 공유하고,
// 반 선택은 학생 탭에서만 쓴다(교사 탭에서는 숨기고 학생 탭으로 돌아오면 그대로 복원된다).
export function AttendanceScreen({
  initialContext,
  readOnly,
}: {
  initialContext: AttendanceInitialContext;
  readOnly: boolean; // 학생 탭 전용(목사님). 교사 탭은 모두 입력 가능하다.
}) {
  const [tab, setTab] = useState<AttendanceTab>('student');
  const [classId, setClassId] = useState(initialContext.defaultClassId);
  const [date, setDate] = useState(initialContext.defaultDate);
  const hydrated = useRef(false);

  // 최초 마운트 시 localStorage(브라우저 전용 외부 저장소)에 기억된 마지막 선택으로 서버 기본값을
  // 덮어쓴다. SSR 시점엔 localStorage가 없어 서버 렌더와 동일한 기본값으로 먼저 그린 뒤, 마운트 후에만
  // 브라우저 값으로 교체해야 하이드레이션이 깨지지 않는다 — effect가 아니면 할 수 없는 동기화다.
  useEffect(() => {
    const stored = loadStoredContext();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 후 1회, 브라우저 전용 저장소 동기화
      setClassId(stored.classId);
      setDate(stored.date);
      setTab(stored.tab);
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveStoredContext({ classId, date, tab });
  }, [classId, date, tab]);

  const header = (
    <>
      <div className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-2" role="tablist" aria-label="출석 대상">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`h-9 flex-1 rounded-lg text-sm font-medium transition sm:flex-none sm:px-6 ${
              tab === t.value
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className={`mx-auto flex w-full max-w-3xl items-center px-4 py-2 ${
          tab === 'student' ? 'justify-between' : 'justify-end'
        }`}
      >
        {tab === 'student' && (
          <ClassPicker classOptions={initialContext.classOptions} classId={classId} onChange={setClassId} />
        )}
        <DatePicker date={date} onChange={setDate} />
      </div>
    </>
  );

  return tab === 'student' ? (
    <StudentAttendancePanel
      initialContext={initialContext}
      readOnly={readOnly}
      classId={classId}
      date={date}
      header={header}
    />
  ) : (
    <TeacherAttendancePanel date={date} showLateButton={initialContext.showLateButton} header={header} />
  );
}
