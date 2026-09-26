import type { NextRequest } from 'next/server';
import { getAccess } from '@/lib/auth';
import { getClassStatisticsResult } from '@/lib/db/statistics';
import { parseStatisticsParams } from '@/lib/statisticsParams';
import { buildStatisticsWorkbook } from '@/lib/xlsx';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// 통계 리포트 .xlsx 다운로드. 화면(getClassStatistics)과 같은 조회 함수를 그대로 써서 숫자가 어긋나지 않게 한다.
// 다운로드용 fetch가 받는 응답이라 requireTeacher()의 redirect 대신 401/403 JSON으로 답한다.
export async function GET(request: NextRequest) {
  const access = await getAccess();
  if (access.status === 'unauthenticated') return errorResponse('로그인이 필요합니다.', 401);
  if (access.status === 'forbidden') return errorResponse('접근 권한이 없습니다.', 403);

  const params = parseStatisticsParams(
    request.nextUrl.searchParams.get('classId'),
    request.nextUrl.searchParams.get('month')
  );
  if (!params) return errorResponse('잘못된 통계 조회 조건입니다.', 400);

  try {
    const result = await getClassStatisticsResult(params.classId, params.month);
    // result.classes는 접근 가능한 전체 반이라 선택한 반 이름도 여기서 찾을 수 있다.
    const selectedClassName =
      params.classId === 'all' ? null : (result.classes.find((c) => c.classId === params.classId)?.className ?? null);
    const body = await buildStatisticsWorkbook(result, { month: params.month, selectedClassName });

    const filename = `attendance-statistics-${params.month}.xlsx`;
    return new Response(body, {
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('통계 엑셀 생성 실패:', e);
    return errorResponse('엑셀 파일을 만들지 못했습니다.', 500);
  }
}
