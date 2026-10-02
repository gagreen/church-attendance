'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClassStatisticsResult, StatisticsInitialContext } from '@/app/actions/statistics';
import type { WeeklyOverview, WeeklyOverviewInitialContext } from '@/app/actions/weeklyReview';
import { MonthlyStatisticsScreen } from './MonthlyStatisticsScreen';
import { WeeklyOverviewScreen } from './WeeklyOverviewScreen';

type View = 'week' | 'month';

const TABS: { value: View; label: string }[] = [
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' },
];

// 통계 화면 셸: 주별 모아보기(기본) · 월별 서브 탭. 진입은 항상 /statistics로 같고, 월별로 바꾸면
// URL에 ?view=month가 붙어 새로고침·공유해도 같은 탭이 유지된다(docs/screens/weekly-review.md).
export function StatisticsScreen({
  initialView,
  monthlyInitialContext,
  monthlyInitialResult,
  weeklyInitialContext,
  weeklyInitialResult,
  isPastor,
}: {
  initialView: View;
  monthlyInitialContext: StatisticsInitialContext;
  monthlyInitialResult: ClassStatisticsResult;
  weeklyInitialContext: WeeklyOverviewInitialContext;
  weeklyInitialResult: WeeklyOverview;
  isPastor: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);

  function changeView(next: View) {
    setView(next);
    router.replace(next === 'month' ? '/statistics?view=month' : '/statistics', { scroll: false });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-2" role="tablist" aria-label="통계 보기">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={view === t.value}
            onClick={() => changeView(t.value)}
            className={`h-9 flex-1 rounded-lg text-sm font-medium transition sm:flex-none sm:px-6 ${
              view === t.value
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'week' ? (
        <WeeklyOverviewScreen initialContext={weeklyInitialContext} initialResult={weeklyInitialResult} isPastor={isPastor} />
      ) : (
        <MonthlyStatisticsScreen initialContext={monthlyInitialContext} initialResult={monthlyInitialResult} />
      )}
    </div>
  );
}
