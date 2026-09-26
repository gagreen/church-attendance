import { requireTeacher } from '@/lib/auth';
import { getClassStatistics, getStatisticsInitialContext } from '@/app/actions/statistics';
import { AppHeader } from '@/components/AppHeader';
import { StatisticsScreen } from '@/components/statistics/StatisticsScreen';

export default async function StatisticsPage() {
  const teacher = await requireTeacher();
  const initialContext = await getStatisticsInitialContext();
  const initialResult = await getClassStatistics({ classId: 'all', month: initialContext.defaultMonth });

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader teacher={teacher} current="statistics" />
      <StatisticsScreen initialContext={initialContext} initialResult={initialResult} />
    </main>
  );
}
