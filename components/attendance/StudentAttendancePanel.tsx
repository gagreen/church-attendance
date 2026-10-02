'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  closeAttendanceAsAbsent,
  getAttendanceView,
  saveAttendanceBatch,
  type AttendanceBatchEntry,
  type AttendanceInitialContext,
  type AttendanceStatus,
  type AttendanceViewRow,
} from '@/app/actions/attendance';
import { StudentRow } from './StudentRow';
import { registerAttendanceBeaconFlush, usePendingAttendance } from './usePendingAttendance';
import { WeeklyReviewPanel } from './WeeklyReviewPanel';

type LoadState = 'loading' | 'ready' | 'error';

const FLUSH_BEACON_URL = '/api/attendance/flush';

// 학생 탭. 탭·반·날짜 선택은 부모(AttendanceScreen)가 갖고, 컨텍스트 바는 `header`로 받아 요약 바와 함께
// 하나의 sticky 영역으로 그린다.
//
// 저장은 탭마다 즉시 하지 않는다(API 호출 절약) — 상태/코멘트 변경은 로컬에만 반영하고
// usePendingAttendance 버퍼에 쌓아뒀다가, ① 반/날짜 전환·이 탭을 벗어남(언마운트), ② 브라우저 탭을
// 숨기거나 닫음(sendBeacon), ③ "출석 종료" 버튼, 세 시점에만 서버로 흘려보낸다.
export function StudentAttendancePanel({
  initialContext,
  readOnly,
  classId,
  date,
  header,
}: {
  initialContext: AttendanceInitialContext;
  readOnly: boolean;
  classId: string;
  date: string;
  header: ReactNode;
}) {
  const [rows, setRows] = useState<AttendanceViewRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [commentOpenIds, setCommentOpenIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const requestId = useRef(0);

  const { dirtyIds, markDirty, getPendingEntries, clearPending } = usePendingAttendance<AttendanceBatchEntry>();

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

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3000);
  }

  // 지금까지 쌓인 변경분을 서버로 보낸다. 실패해도 로컬 입력(rows)은 그대로 두고 버퍼에 남겨서 다음
  // 플러시 시점에 다시 시도한다 — 반/날짜를 바꾸거나 화면을 벗어나는 순간 되돌리면 교사가 방금 누른
  // 내용이 사라져 보이므로, 실패 신호만 토스트로 준다.
  const flushPending = useCallback(
    async (targetDate: string) => {
      const entries = getPendingEntries();
      if (entries.length === 0) return;
      try {
        const result = await saveAttendanceBatch({ date: targetDate, entries });
        if (result.ok) clearPending();
        else showToast(result.error);
      } catch {
        showToast('저장에 실패했습니다. 다시 시도해 주세요.');
      }
    },
    [getPendingEntries, clearPending]
  );

  // 반/날짜 변경 시 재조회 시작을 알리는 로딩 상태 전환(load 내부 setLoadState) — 실제 데이터는 비동기
  // 콜백에서 반영된다. cleanup은 "지금까지의" classId/date로 닫히는 클로저라, 다음 반/날짜로 넘어가기
  // 직전이나 이 탭을 벗어날 때(언마운트) 방금 쓴 변경분을 그 반/날짜 기준으로 흘려보낸다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(classId, date);
    return () => {
      flushPending(date);
    };
  }, [classId, date, load, flushPending]);

  // 탭 숨김·페이지 닫기 시 sendBeacon으로 흘려보낸다(Server Action은 이 시점에 응답을 기다릴 수 없음).
  useEffect(() => {
    return registerAttendanceBeaconFlush(() => {
      const entries = getPendingEntries();
      if (entries.length === 0) return;
      const blob = new Blob([JSON.stringify({ kind: 'student', date, entries })], {
        type: 'application/json',
      });
      navigator.sendBeacon(FLUSH_BEACON_URL, blob);
    });
  }, [date, getPendingEntries]);

  function handleStatusChange(row: AttendanceViewRow, status: AttendanceStatus) {
    setRows((current) => current.map((r) => (r.studentId === row.studentId ? { ...r, status } : r)));
    markDirty(row.studentId, { studentId: row.studentId, classId: row.classId, status, comment: row.comment });
  }

  function handleCommentCommit(row: AttendanceViewRow, comment: string) {
    if (row.status === null) return; // 상태 선택 전에는 코멘트 입력 자체가 막혀 있어 정상 흐름에선 안 옴
    const trimmed = comment.trim();
    const nextComment = trimmed || null;
    setRows((current) =>
      current.map((r) => (r.studentId === row.studentId ? { ...r, comment: nextComment } : r))
    );
    markDirty(row.studentId, {
      studentId: row.studentId,
      classId: row.classId,
      status: row.status,
      comment: nextComment,
    });
  }

  function handleCloseAttendance() {
    const missing = rows.filter((r) => r.status === null);
    const entries = getPendingEntries();
    if (closing || (missing.length === 0 && entries.length === 0)) return;
    if (missing.length > 0 && !window.confirm(`입력하지 않은 ${missing.length}명을 모두 결석으로 저장할까요?`))
      return;

    const missingIds = new Set(missing.map((r) => r.studentId));
    setClosing(true);
    if (missingIds.size > 0) {
      setRows((current) => current.map((r) => (missingIds.has(r.studentId) ? { ...r, status: '결석' } : r)));
    }
    const rollbackMissing = () => {
      if (missingIds.size === 0) return;
      setRows((current) => current.map((r) => (missingIds.has(r.studentId) ? { ...r, status: null } : r)));
    };

    closeAttendanceAsAbsent({
      date,
      students: missing.map((r) => ({ studentId: r.studentId, classId: r.classId })),
      entries,
    })
      .then((result) => {
        if (result.ok) {
          clearPending();
        } else {
          rollbackMissing();
          showToast(result.error);
        }
      })
      .catch(() => {
        rollbackMissing();
        showToast('출석 종료 처리에 실패했습니다. 다시 시도해 주세요.');
      })
      .finally(() => setClosing(false));
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
        {header}
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 pb-2 text-xs text-zinc-500">
          <span>
            출석 {summary.출석}
            {(initialContext.showLateButton || summary.지각 > 0) && <> · 지각 {summary.지각}</>} · 결석 {summary.결석} ·
            공예배 {summary.공예배}
            {dirtyIds.size > 0 && (
              <span className="text-amber-600 dark:text-amber-400"> · 저장 대기 {dirtyIds.size}</span>
            )}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={handleCloseAttendance}
              disabled={closing || loadState !== 'ready' || (!rows.some((r) => r.status === null) && dirtyIds.size === 0)}
              className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {closing ? '처리 중…' : '출석 종료'}
            </button>
          )}
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
                showLateButton={initialContext.showLateButton}
                saving={false}
                dirty={dirtyIds.has(row.studentId)}
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

        {/* '전체' 보기에서는 어느 반의 총평인지 모호해지므로 숨긴다(docs/screens/weekly-review.md). */}
        {classId !== 'all' && (
          <WeeklyReviewPanel
            classId={classId}
            className={initialContext.classOptions.find((c) => c.id === classId)?.name ?? ''}
            date={date}
            readOnly={readOnly}
          />
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
