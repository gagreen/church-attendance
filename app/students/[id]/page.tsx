import { notFound } from 'next/navigation';
import { requireTeacher } from '@/lib/auth';
import { getStudentDetail } from '@/app/actions/students';
import { StudentDetailScreen } from '@/components/student-detail/StudentDetailScreen';

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const detail = await getStudentDetail({ studentId: id });
  if (!detail) notFound();

  return <StudentDetailScreen studentId={id} initialDetail={detail} readOnly={teacher.role === 'pastor'} />;
}
