'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AttendanceStatus } from '@/app/actions/attendance';
import {
  closeTeacherAttendanceAsAbsent,
  getTeacherAttendanceView,
  saveTeacherAttendanceComment,
  saveTeacherAttendanceStatus,
  type TeacherAttendanceRow,
} from '@/app/actions/teacherAttendance';
import { TeacherRow } from './TeacherRow';

type LoadState = 'loading' | 'ready' | 'error';

// 교사 탭(docs/screens/teacher-attendance.md). 동작은 StudentAttendancePanel과 같고, 반 선택이 없으며
// 읽기 전용이 없다(목사님 포함 모두 입력 가능). 날짜와 컨텍스트 바(`header`)는 부모가 관리한다.
export function TeacherAttendancePanel({
  date,
  showLateButton,
  header,
}: {
  date: string;
  showLateButton: boolean;
  header: ReactNode;
}) {
  const [rows, setRows] = useState<TeacherAttendanceRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [commentOpenIds, setCommentOpenIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback((targetDate: string) => {
    const myRequestId = ++requestId.current;
    setLoadState((prev) => (prev === 'ready' ? prev : 'loading'));
    getTeacherAttendanceView({ date: targetDate })
      .then((data) => {
        if (myRequestId !== requestId.current) return;
        setRows(data);
        setLoadState('ready');
      })
      .catch((e) => {
        if (myRequestId !== requestId.current) return;
        console.error('교사 출석 조회 실패:', e);
        setLoadState('error');
      });
  }, []);

  // 날짜 변경 시 재조회 시작을 알리는 로딩 상태 전환(load 내부 setLoadState) — 실제 데이터는 비동기 콜백에서 반영된다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date);
  }, [date, load]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3000);
  }

  function updateRow(teacherId: string, patch: Partial<TeacherAttendanceRow>) {
    setRows((current) => current.map((r) => (r.teacherId === teacherId ? { ...r, ...patch } : r)));
  }

  function withSaving(teacherId: string, task: Promise<{ ok: true } | { ok: false; error: string }>, rollback: () => void) {
    setSavingIds((current) => new Set(current).add(teacherId));
    task
      .then((result) => {
        if (!result.ok) {
          rollback();
          showToast(result.error);
        }
      })
      .catch(() => {
        rollback();
        showToast('저장에 실패했습니다. 다시 시도해 주세요.');
      })
      .finally(() => {
        setSavingIds((current) => {
          const next = new Set(current);
          next.delete(teacherId);
          return next;
        });
      });
  }

  function handleStatusChange(row: TeacherAttendanceRow, status: AttendanceStatus) {
    const prevStatus = row.status;
    updateRow(row.teacherId, { status });
    withSaving(
      row.teacherId,
      saveTeacherAttendanceStatus({ teacherId: row.teacherId, date, status }),
      () => updateRow(row.teacherId, { status: prevStatus })
    );
  }

  function handleCommentCommit(row: TeacherAttendanceRow, comment: string) {
    const prevComment = row.comment;
    const trimmed = comment.trim();
    updateRow(row.teacherId, { comment: trimmed || null });
    withSaving(
      row.teacherId,
      saveTeacherAttendanceComment({ teacherId: row.teacherId, date, comment: trimmed }),
      () => updateRow(row.teacherId, { comment: prevComment })
    );
  }

  function handleCloseAttendance() {
    const unchecked = rows.filter((r) => r.status === null);
    if (unchecked.length === 0 || closing) return;
    if (!window.confirm(`입력하지 않은 교사 ${unchecked.length}명을 모두 결석으로 저장할까요?`)) return;

    const uncheckedIds = new Set(unchecked.map((r) => r.teacherId));
    setClosing(true);
    setRows((current) => current.map((r) => (uncheckedIds.has(r.teacherId) ? { ...r, status: '결석' } : r)));
    const rollback = () =>
      setRows((current) => current.map((r) => (uncheckedIds.has(r.teacherId) ? { ...r, status: null } : r)));

    closeTeacherAttendanceAsAbsent({ date, teacherIds: [...uncheckedIds] })
      .then((result) => {
        if (!result.ok) {
          rollback();
          showToast(result.error);
        }
      })
      .catch(() => {
        rollback();
        showToast('출석 종료 처리에 실패했습니다. 다시 시도해 주세요.');
      })
      .finally(() => setClosing(false));
  }

  function toggleComment(teacherId: string) {
    setCommentOpenIds((current) => {
      const next = new Set(current);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  }

  const summary = rows.reduce(
    (acc, r) => {
      if (r.status === '출석') acc.출석 += 1;
      else if (r.status === '지각') acc.지각 += 1;
      else if (r.status === '공예배') acc.공예배 += 1;
      else acc.결석 += 1; // 결석 + 미체크(null)
      return acc;
    },
    { 출석: 0, 지각: 0, 결석: 0, 공예배: 0 }
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        {header}
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 pb-2 text-xs text-zinc-500">
          <span>
            출석 {summary.출석}
            {(showLateButton || summary.지각 > 0) && <> · 지각 {summary.지각}</>} · 결석 {summary.결석} · 공예배{' '}
            {summary.공예배}
          </span>
          <button
            type="button"
            onClick={handleCloseAttendance}
            disabled={closing || loadState !== 'ready' || !rows.some((r) => r.status === null)}
            className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {closing ? '처리 중…' : '출석 종료'}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-3">
        {loadState === 'loading' && rows.length === 0 && (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            ))}
          </ul>
        )}

        {loadState === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
            <p>교사 출석 목록을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => load(date)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"
            >
              다시 시도
            </button>
          </div>
        )}

        {loadState === 'ready' && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">출석을 관리할 교사가 없습니다.</p>
        )}

        {rows.length > 0 && (
          <ul className={`flex flex-col gap-2 ${loadState === 'loading' ? 'opacity-60' : ''}`}>
            {rows.map((row) => (
              <TeacherRow
                key={row.teacherId}
                row={row}
                showLateButton={showLateButton}
                saving={savingIds.has(row.teacherId)}
                commentOpen={commentOpenIds.has(row.teacherId)}
                onToggleComment={() => toggleComment(row.teacherId)}
                onCommentBlockedTap={() => showToast('상태를 먼저 선택하세요')}
                onStatusChange={(status) => handleStatusChange(row, status)}
                onCommentCommit={(comment) => handleCommentCommit(row, comment)}
              />
            ))}
          </ul>
        )}
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
