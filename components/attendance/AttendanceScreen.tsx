'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAttendanceView,
  saveAttendanceComment,
  saveAttendanceStatus,
  type AttendanceInitialContext,
  type AttendanceStatus,
  type AttendanceViewRow,
} from '@/app/actions/attendance';
import { loadStoredContext, saveStoredContext } from '@/lib/attendanceStorage';
import { ClassPicker } from './ClassPicker';
import { DatePicker } from './DatePicker';
import { StudentRow } from './StudentRow';

type LoadState = 'loading' | 'ready' | 'error';

export function AttendanceScreen({
  initialContext,
  readOnly,
}: {
  initialContext: AttendanceInitialContext;
  readOnly: boolean;
}) {
  const [classId, setClassId] = useState(initialContext.defaultClassId);
  const [date, setDate] = useState(initialContext.defaultDate);
  const [rows, setRows] = useState<AttendanceViewRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [commentOpenIds, setCommentOpenIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const hydrated = useRef(false);
  const requestId = useRef(0);

  // 최초 마운트 시 localStorage(브라우저 전용 외부 저장소)에 기억된 마지막 선택으로 서버 기본값을
  // 덮어쓴다. SSR 시점엔 localStorage가 없어 서버 렌더와 동일한 기본값으로 먼저 그린 뒤, 마운트 후에만
  // 브라우저 값으로 교체해야 하이드레이션이 깨지지 않는다 — effect가 아니면 할 수 없는 동기화다.
  useEffect(() => {
    const stored = loadStoredContext();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 후 1회, 브라우저 전용 저장소 동기화
      setClassId(stored.classId);
      setDate(stored.date);
    }
    hydrated.current = true;
  }, []);

  const load = useCallback((targetClassId: string, targetDate: string) => {
    const myRequestId = ++requestId.current;
    setLoadState((prev) => (prev === 'ready' ? prev : 'loading'));
    getAttendanceView({ classId: targetClassId, date: targetDate })
      .then((data) => {
        if (myRequestId !== requestId.current) return;
        setRows(data);
        setLoadState('ready');
      })
      .catch((e) => {
        if (myRequestId !== requestId.current) return;
        console.error('출석 조회 실패:', e);
        setLoadState('error');
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveStoredContext({ classId, date });
  }, [classId, date]);

  // 반/날짜 변경 시 재조회 시작을 알리는 로딩 상태 전환(load 내부 setLoadState) — 실제 데이터는 비동기
  // 콜백에서 반영된다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(classId, date);
  }, [classId, date, load]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3000);
  }

  function withSaving(studentId: string, task: Promise<{ ok: true } | { ok: false; error: string }>, rollback: () => void) {
    setSavingIds((current) => new Set(current).add(studentId));
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
          next.delete(studentId);
          return next;
        });
      });
  }

  function handleStatusChange(row: AttendanceViewRow, status: AttendanceStatus) {
    const prevStatus = row.status;
    setRows((current) =>
      current.map((r) => (r.studentId === row.studentId ? { ...r, status } : r))
    );
    withSaving(
      row.studentId,
      saveAttendanceStatus({ studentId: row.studentId, classId: row.classId, date, status }),
      () =>
        setRows((current) =>
          current.map((r) => (r.studentId === row.studentId ? { ...r, status: prevStatus } : r))
        )
    );
  }

  function handleCommentCommit(row: AttendanceViewRow, comment: string) {
    const prevComment = row.comment;
    const trimmed = comment.trim();
    setRows((current) =>
      current.map((r) => (r.studentId === row.studentId ? { ...r, comment: trimmed || null } : r))
    );
    withSaving(
      row.studentId,
      saveAttendanceComment({ studentId: row.studentId, classId: row.classId, date, comment: trimmed }),
      () =>
        setRows((current) =>
          current.map((r) => (r.studentId === row.studentId ? { ...r, comment: prevComment } : r))
        )
    );
  }

  function toggleComment(studentId: string) {
    setCommentOpenIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
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
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2">
          <ClassPicker classOptions={initialContext.classOptions} classId={classId} onChange={setClassId} />
          <DatePicker date={date} onChange={setDate} />
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-2 text-xs text-zinc-500">
          출석 {summary.출석} · 지각 {summary.지각} · 결석 {summary.결석} · 공예배 {summary.공예배}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-3">
        {loadState === 'loading' && rows.length === 0 && (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            ))}
          </ul>
        )}

        {loadState === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
            <p>출석 목록을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => load(classId, date)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"
            >
              다시 시도
            </button>
          </div>
        )}

        {loadState === 'ready' && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">학생이 없습니다.</p>
        )}

        {rows.length > 0 && (
          <ul className={`flex flex-col gap-2 ${loadState === 'loading' ? 'opacity-60' : ''}`}>
            {rows.map((row) => (
              <StudentRow
                key={row.studentId}
                row={row}
                showClassTag={classId === 'all'}
                saving={savingIds.has(row.studentId)}
                commentOpen={commentOpenIds.has(row.studentId)}
                readOnly={readOnly}
                onToggleComment={() => toggleComment(row.studentId)}
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
