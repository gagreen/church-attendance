import ExcelJS from 'exceljs';
import { formatMonthLabel } from '@/lib/date';
import type { ClassStatisticsResult } from '@/lib/db/statistics';

// 엑셀 산출물 생성 공통 헬퍼. 화면 조회 결과를 그대로 시트로 옮기기만 하고 집계는 다시 계산하지 않는다.
// SheetJS(xlsx)는 npm 배포판에 미패치 취약점이 있어 쓰지 않는다(CLAUDE.md).

// 시트 이름 제약: 31자 이하, [ ] : * ? / \ 사용 불가.
function sheetName(raw: string): string {
  return raw.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
    cell.border = { bottom: { style: 'thin' } };
  });
}

const RATE_HEADER = '출석률(%)';
const NO_RECORD = '-'; // 기록이 0건이라 출석률을 정의할 수 없음

export type StatisticsWorkbookOptions = {
  month: string; // YYYY-MM
  selectedClassName: string | null; // 학생별 시트에 쓸 반 이름 (전체면 null)
};

export async function buildStatisticsWorkbook(
  result: ClassStatisticsResult,
  options: StatisticsWorkbookOptions
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const summary = workbook.addWorksheet(sheetName(`반별 요약 ${formatMonthLabel(options.month)}`));
  summary.columns = [
    { header: '반', key: 'className', width: 14 },
    { header: RATE_HEADER, key: 'rate', width: 11 },
    { header: '출석', key: 'present', width: 8 },
    { header: '지각', key: 'late', width: 8 },
    { header: '결석', key: 'absent', width: 8 },
    { header: '공예배', key: 'worship', width: 8 },
    { header: '기록 수', key: 'recorded', width: 10 },
    { header: '예상 슬롯', key: 'expected', width: 10 },
  ];
  styleHeader(summary.getRow(1));
  for (const c of result.classes) {
    summary.addRow({
      className: c.className,
      rate: c.presentRate ?? NO_RECORD,
      present: c.counts.출석,
      late: c.counts.지각,
      absent: c.counts.결석,
      worship: c.counts.공예배,
      recorded: c.recordedCount,
      expected: c.expectedSlots,
    });
  }

  if (result.students) {
    const label = options.selectedClassName ?? '선택 반';
    const detail = workbook.addWorksheet(sheetName(`학생별 ${label}`));
    detail.columns = [
      { header: '이름', key: 'name', width: 14 },
      { header: RATE_HEADER, key: 'rate', width: 11 },
      { header: '출석', key: 'present', width: 8 },
      { header: '지각', key: 'late', width: 8 },
      { header: '결석', key: 'absent', width: 8 },
      { header: '공예배', key: 'worship', width: 8 },
      { header: '기록 수', key: 'recorded', width: 10 },
    ];
    styleHeader(detail.getRow(1));
    for (const s of result.students) {
      detail.addRow({
        name: s.studentName,
        rate: s.presentRate ?? NO_RECORD,
        present: s.counts.출석,
        late: s.counts.지각,
        absent: s.counts.결석,
        worship: s.counts.공예배,
        recorded: s.recordedCount,
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
