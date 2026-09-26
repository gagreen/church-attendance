import { createClient } from '@/lib/supabase/server';
import { sortStudents } from '@/lib/db/students';

export type StatusCounts = { 출석: number; 지각: number; 결석: number; 공예배: number };

export type ClassStatRow = {
  classId: string;
  className: string;
  recordedCount: number; // 실제 기록된 attendance 행 수
  expectedSlots: number; // 활성 학생 수 x 그 달 일요일 수 (커버리지 표시용)
  presentRate: number | null; // 0~100 정수. 기록이 0건이면 null(정의 불가)
  counts: StatusCounts;
};

export type StudentStatRow = {
  studentId: string;
  studentName: string;
  recordedCount: number;
  presentRate: number | null;
  counts: StatusCounts;
};

// month: 'YYYY-MM'. 집계(출석률 정의 포함)는 전부 DB 함수(0006 마이그레이션)가 계산하고, 여기서는 결과 행을
// 화면용 모양으로 옮기기만 한다. RLS는 security invoker 함수라 호출자 권한 그대로 적용된다.
export async function listClassStats(month: string): Promise<ClassStatRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('class_month_stats', { p_month: `${month}-01` });
  if (error) throw new Error(`class_month_stats 조회 실패: ${error.message}`);

  return (data ?? []).map((r) => ({
    classId: r.class_id,
    className: r.class_name,
    recordedCount: r.recorded_count,
    expectedSlots: r.expected_slots,
    presentRate: r.present_rate,
    counts: { 출석: r.present_count, 지각: r.late_count, 결석: r.absent_count, 공예배: r.worship_count },
  }));
}

// 한 반의 학생별 통계. 학년 내림차순 → 이름순(sortStudents)으로 정렬해 돌려준다.
export async function listStudentStats(classId: string, month: string): Promise<StudentStatRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('student_month_stats', {
    p_class_id: classId,
    p_month: `${month}-01`,
  });
  if (error) throw new Error(`student_month_stats 조회 실패: ${error.message}`);

  const rows = (data ?? []).map((r) => ({
    grade: r.grade as string | null,
    name: r.student_name,
    row: {
      studentId: r.student_id,
      studentName: r.student_name,
      recordedCount: r.recorded_count,
      presentRate: r.present_rate as number | null,
      counts: { 출석: r.present_count, 지각: r.late_count, 결석: r.absent_count, 공예배: r.worship_count },
    } satisfies StudentStatRow,
  }));
  return sortStudents(rows).map((r) => r.row);
}

export type ClassStatisticsResult = {
  classes: ClassStatRow[];
  students: StudentStatRow[] | null; // classId가 'all'이 아닐 때만 채워짐
};

// 통계 화면·엑셀 내보내기가 공유하는 조회. classes는 항상 접근 가능한 전체 반(요약·드릴다운 진입용),
// students는 특정 반을 골랐을 때만 그 반 학생들.
export async function getClassStatisticsResult(
  classId: string | 'all',
  month: string
): Promise<ClassStatisticsResult> {
  const [classes, students] = await Promise.all([
    listClassStats(month),
    classId === 'all' ? Promise.resolve(null) : listStudentStats(classId, month),
  ]);
  return { classes, students };
}
