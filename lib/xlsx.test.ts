import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { ClassStatisticsResult } from '@/lib/db/statistics';
import { buildStatisticsWorkbook } from './xlsx';

const counts = { 출석: 3, 지각: 1, 결석: 0, 공예배: 0 };

const result: ClassStatisticsResult = {
  classes: [
    { classId: 'c1', className: '1', recordedCount: 4, expectedSlots: 8, presentRate: 100, counts },
    { classId: 'c2', className: '2', recordedCount: 0, expectedSlots: 4, presentRate: null, counts: { 출석: 0, 지각: 0, 결석: 0, 공예배: 0 } },
  ],
  students: [{ studentId: 's1', studentName: '김민수', recordedCount: 4, presentRate: 100, counts }],
};

async function read(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

describe('buildStatisticsWorkbook', () => {
  it('반 전체: 반별 요약 시트만 만든다', async () => {
    const wb = await read(await buildStatisticsWorkbook({ ...result, students: null }, { month: '2026-09', selectedClassName: null }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['반별 요약 2026년 9월']);
    const ws = wb.worksheets[0];
    expect(ws.getRow(2).values).toEqual([undefined, '1', 100, 3, 1, 0, 0, 4, 8]);
    expect(ws.getRow(3).getCell(2).value).toBe('-'); // 기록 0건 → 출석률 정의 불가
  });

  it('특정 반: 학생별 시트가 추가된다', async () => {
    const wb = await read(await buildStatisticsWorkbook(result, { month: '2026-09', selectedClassName: '1' }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['반별 요약 2026년 9월', '학생별 1']);
    expect(wb.worksheets[1].getRow(2).values).toEqual([undefined, '김민수', 100, 3, 1, 0, 0, 4]);
  });

  it('시트 이름에 쓸 수 없는 문자는 치환한다', async () => {
    const wb = await read(await buildStatisticsWorkbook(result, { month: '2026-09', selectedClassName: 'A/B:C' }));
    expect(wb.worksheets[1].name).toBe('학생별 A B C');
  });
});
