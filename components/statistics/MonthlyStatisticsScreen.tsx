'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getClassStatistics,
  type ClassStatisticsResult,
  type StatisticsInitialContext,
  type StatusCounts,
} from '@/app/actions/statistics';
import { addMonths, formatMonthLabel } from '@/lib/date';
import { ClassPicker } from '@/components/attendance/ClassPicker';

type LoadState = 'loading' | 'ready' | 'error';

function formatRate(rate: number | null): string {
  return rate === null ? '기록 없음' : `${rate}%`;
}

function CountsLine({ counts }: { counts: StatusCounts }) {
  return (
    <span className="tabular-nums">
      출석 {counts.출석} · 지각 {counts.지각} · 결석 {counts.결석} · 공예배 {counts.공예배}
    </span>
  );
}

// 통계 > 월별 서브 탭. 반별/학생별 월간 출석률(docs/screens/statistics.md) — 주별 모아보기가 기본 화면이 되면서
// 기존 화면 그대로 서브 탭으로 옮겨졌다(동작 변경 없음).
export function MonthlyStatisticsScreen({
  initialContext,
  initialResult,
}: {
  initialContext: StatisticsInitialContext;
  initialResult: ClassStatisticsResult;
}) {
  const currentMonth = initialContext.defaultMonth;
  const [classId, setClassId] = useState('all');
  const [month, setMonth] = useState(currentMonth);
  const [result, setResult] = useState(initialResult);
  const [loadState, setLoadState] = useState<LoadState>('ready');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback((targetClassId: string, targetMonth: string) => {
    const myRequestId = ++requestId.current;
    setLoadState((prev) => (prev === 'ready' ? prev : 'loading'));
    getClassStatistics({ classId: targetClassId, month: targetMonth })
      .then((data) => {
        if (myRequestId !== requestId.current) return;
        setResult(data);
        setLoadState('ready');
      })
      .catch((e) => {
        if (myRequestId !== requestId.current) return;
        console.error('통계 조회 실패:', e);
        setLoadState('error');
      });
  }, []);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3000);
  }

  function changeClass(nextClassId: string) {
    setClassId(nextClassId);
    load(nextClassId, month);
  }

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    load(classId, nextMonth);
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/statistics/export?classId=${encodeURIComponent(classId)}&month=${month}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `출석통계_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('통계 엑셀 내보내기 실패:', e);
      showToast('엑셀 내보내기에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setExporting(false);
    }
  }

  const selectedClass = result.classes.find((c) => c.classId === classId);
  const busy = loadState === 'loading';

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2">
          <ClassPicker classOptions={initialContext.classOptions} classId={classId} onChange={changeClass} />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => changeMonth(addMonths(month, -1))}
              aria-label="이전 달"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ‹
            </button>
            <span className="px-2 text-base font-semibold tabular-nums">{formatMonthLabel(month)}</span>
            <button
              type="button"
              onClick={() => changeMonth(addMonths(month, 1))}
              disabled={month >= currentMonth}
              aria-label="다음 달"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-3">
        {loadState === 'error' && (
          <div className="mb-3 flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
            <p>통계를 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => load(classId, month)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"
            >
              다시 시도
            </button>
          </div>
        )}

        <div className={busy || loadState === 'error' ? 'opacity-60' : ''}>
          {/* 반을 하나 선택하면 학생별 상세만 보고 싶어하므로(반 선택 자체는 ClassPicker가 담당) 반별 요약은 숨긴다. */}
          {classId === 'all' && (
            <section aria-labelledby="class-summary">
              <h2 id="class-summary" className="mb-2 text-sm font-semibold text-zinc-500">
                반별 요약
              </h2>
              {result.classes.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">조회할 수 있는 반이 없습니다.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {result.classes.map((c) => {
                    const selected = c.classId === classId;
                    return (
                      <li key={c.classId}>
                        <button
                          type="button"
                          onClick={() => changeClass(selected ? 'all' : c.classId)}
                          aria-pressed={selected}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            selected
                              ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                              : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold">{c.className}</span>
                            <span className="text-sm font-semibold tabular-nums">
                              출석률 {formatRate(c.presentRate)}
                              <span className="ml-1.5 text-xs font-normal text-zinc-500">
                                (기록 {c.recordedCount}/{c.expectedSlots})
                              </span>
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            <CountsLine counts={c.counts} />
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {result.students && (
            <section aria-labelledby="student-detail" className={classId === 'all' ? 'mt-5' : ''}>
              <h2 id="student-detail" className="mb-2 text-sm font-semibold text-zinc-500">
                학생별 상세{selectedClass ? ` — ${selectedClass.className}` : ''}
              </h2>
              {result.students.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">학생이 없습니다.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {result.students.map((s) => (
                    <li key={s.studentId}>
                      <Link
                        href={`/students/${s.studentId}`}
                        className="flex flex-col gap-0.5 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{s.studentName}</span>
                          <span className="text-sm font-semibold tabular-nums">{formatRate(s.presentRate)}</span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          <CountsLine counts={s.counts} />
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {classId !== 'all' && (
            <button
              type="button"
              onClick={() => changeClass('all')}
              className="mt-5 w-full rounded-xl border border-dashed border-zinc-300 p-3 text-center text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              다른 반 보기
            </button>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {exporting ? '만드는 중…' : '엑셀로 내보내기'}
          </button>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
