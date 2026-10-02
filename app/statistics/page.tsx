import { requireTeacher } from '@/lib/auth';
import { getClassStatistics, getStatisticsInitialContext } from '@/app/actions/statistics';
import { getWeeklyOverview, getWeeklyOverviewInitialContext } from '@/app/actions/weeklyReview';
import { AppHeader } from '@/components/AppHeader';
import { StatisticsScreen } from '@/components/statistics/StatisticsScreen';

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const teacher = await requireTeacher();
  const { view } = await searchParams;
  const initialView = view === 'month' ? 'month' : 'week';

  const [monthlyInitialContext, weeklyInitialContext] = await Promise.all([
    getStatisticsInitialContext(),
    getWeeklyOverviewInitialContext(),
  ]);
  const [monthlyInitialResult, weeklyInitialResult] = await Promise.all([
    getClassStatistics({ classId: 'all', month: monthlyInitialContext.defaultMonth }),
    getWeeklyOverview({ classId: 'all', weekStart: weeklyInitialContext.defaultWeekStart }),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader teacher={teacher} current="statistics" />
      <StatisticsScreen
        initialView={initialView}
        monthlyInitialContext={monthlyInitialContext}
        monthlyInitialResult={monthlyInitialResult}
        weeklyInitialContext={weeklyInitialContext}
        weeklyInitialResult={weeklyInitialResult}
        isPastor={teacher.role === 'pastor'}
      />
    </main>
  );
}
