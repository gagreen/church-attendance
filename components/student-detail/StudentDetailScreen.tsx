'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  addStudentNote,
  deleteStudentNote,
  getStudentDetail,
  type AttendanceHistoryRow as AttendanceHistoryRowData,
  type StudentDetailResult,
} from '@/app/actions/students';
import { saveAttendanceComment, saveAttendanceStatus, type AttendanceStatus } from '@/app/actions/attendance';
import { formatDateDotted, formatDateLabel } from '@/lib/date';
import { AttendanceStatusRow } from '@/components/attendance/AttendanceStatusRow';

type LoadState = 'loading' | 'ready' | 'error';

export function StudentDetailScreen({
  studentId,
  initialDetail,
  readOnly,
}: {
  studentId: string;
  initialDetail: StudentDetailResult;
  readOnly: boolean;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [year, setYear] = useState(initialDetail.availableYears[0]);
  const [loadState, setLoadState] = useState<LoadState>('ready');
  const [commentOpenDates, setCommentOpenDates] = useState<Set<string>>(new Set());
  const [savingDates, setSavingDates] = useState<Set<string>>(new Set());
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [deletingNoteIds, setDeletingNoteIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  // state는 다음 렌더에야 반영되므로, 같은 틱에 연달아 들어오는 등록 요청(Enter 연타·IME 이중 keydown)을
  // 막으려면 동기적으로 읽히는 ref 가드가 필요하다.
  const noteSubmitting = useRef(false);

  const load = useCallback(
    (targetYear: number) => {
      setLoadState((prev) => (prev === 'ready' ? prev : 'loading'));
      getStudentDetail({ studentId, year: targetYear })
        .then((result) => {
          if (!result) {
            setLoadState('error');
            return;
          }
          setDetail(result);
          setLoadState('ready');
        })
        .catch((e) => {
          console.error('학생 상세 조회 실패:', e);
          setLoadState('error');
        });
    },
    [studentId]
  );

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3000);
  }

  function changeYear(nextYear: number) {
    setYear(nextYear);
    load(nextYear);
  }

  function patchHistoryRow(date: string, patch: Partial<AttendanceHistoryRowData>) {
    setDetail((current) => ({
      ...current,
      attendanceHistory: current.attendanceHistory.map((r) => (r.date === date ? { ...r, ...patch } : r)),
    }));
  }

  function withSaving(date: string, task: Promise<{ ok: true } | { ok: false; error: string }>, rollback: () => void) {
    setSavingDates((current) => new Set(current).add(date));
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
        setSavingDates((current) => {
          const next = new Set(current);
          next.delete(date);
          return next;
        });
      });
  }

  function handleStatusChange(row: AttendanceHistoryRowData, status: AttendanceStatus) {
    const prevStatus = row.status;
    patchHistoryRow(row.date, { status });
    withSaving(
      row.date,
      saveAttendanceStatus({ studentId, classId: row.classId, date: row.date, status }),
      () => patchHistoryRow(row.date, { status: prevStatus })
    );
  }

  function handleCommentCommit(row: AttendanceHistoryRowData, comment: string) {
    const prevComment = row.comment;
    const trimmed = comment.trim();
    patchHistoryRow(row.date, { comment: trimmed || null });
    withSaving(
      row.date,
      saveAttendanceComment({ studentId, classId: row.classId, date: row.date, comment: trimmed }),
      () => patchHistoryRow(row.date, { comment: prevComment })
    );
  }

  function toggleComment(date: string) {
    setCommentOpenDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function handleAddNote() {
    const trimmed = noteDraft.trim();
    if (trimmed === '' || noteSubmitting.current) return;
    noteSubmitting.current = true;
    setNoteSaving(true);
    addStudentNote({ studentId, note: trimmed })
      .then((result) => {
        if (result.ok) {
          setNoteDraft('');
          load(year);
        } else {
          showToast(result.error);
        }
      })
      .catch(() => showToast('저장에 실패했습니다. 다시 시도해 주세요.'))
      .finally(() => {
        noteSubmitting.current = false;
        setNoteSaving(false);
      });
  }

  function handleDeleteNote(noteId: string) {
    if (!window.confirm('이 메모를 삭제할까요? 삭제한 메모는 되돌릴 수 없습니다.')) return;
    setDeletingNoteIds((current) => new Set(current).add(noteId));
    deleteStudentNote({ noteId })
      .then((result) => {
        if (result.ok) {
          setDetail((current) => ({ ...current, notes: current.notes.filter((n) => n.id !== noteId) }));
        } else {
          showToast(result.error);
        }
      })
      .catch(() => showToast('삭제에 실패했습니다. 다시 시도해 주세요.'))
      .finally(() => {
        setDeletingNoteIds((current) => {
          const next = new Set(current);
          next.delete(noteId);
          return next;
        });
      });
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            aria-label="뒤로가기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ←
          </Link>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-base font-semibold">
              {detail.student.name}
              {!detail.student.isActive && (
                <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  비활성
                </span>
              )}
            </p>
            <p className="text-xs text-zinc-500">
              {detail.student.grade ?? '미지정'} · {detail.student.className}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="mb-2 text-sm font-semibold">프로필 메모</h2>

        {!readOnly && (
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                // 한글 등 IME 조합 중 Enter는 조합 확정용이라 제출로 취급하지 않는다(확정 시 keydown이 한 번 더 발생함).
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddNote();
              }}
              placeholder="새 메모 추가..."
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={noteSaving || noteDraft.trim() === ''}
              className="shrink-0 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white/95 transition hover:bg-sky-800 dark:bg-sky-800 dark:text-sky-50 dark:hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              등록
            </button>
          </div>
        )}

        {detail.notes.length === 0 ? (
          <p className="text-sm text-zinc-400">등록된 메모가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400">
                    {formatDateDotted(n.createdAt)} · {n.authorName}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{n.note}</p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(n.id)}
                    disabled={deletingNoteIds.has(n.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30"
                  >
                    {deletingNoteIds.has(n.id) ? '삭제 중…' : '삭제'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">출석 이력</h2>
          <select
            value={year}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
          >
            {detail.availableYears.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          출석 {detail.summary.출석}
          {(detail.showLateButton || detail.summary.지각 > 0) && <> · 지각 {detail.summary.지각}</>} · 결석{' '}
          {detail.summary.결석} · 공예배 {detail.summary.공예배}
        </p>

        {loadState === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
            <p>출석 이력을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => load(year)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"
            >
              다시 시도
            </button>
          </div>
        )}

        {loadState !== 'error' && detail.attendanceHistory.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">{year}년 기록이 없습니다.</p>
        )}

        {loadState !== 'error' && detail.attendanceHistory.length > 0 && (
          <ul className={`flex flex-col gap-2 ${loadState === 'loading' ? 'opacity-60' : ''}`}>
            {detail.attendanceHistory.map((row) => (
              <AttendanceStatusRow
                key={row.date}
                leading={
                  <p className="w-[5.5rem] shrink-0 text-xs font-medium text-zinc-600 sm:w-24 sm:text-sm dark:text-zinc-300">
                    {formatDateLabel(row.date)}
                  </p>
                }
                status={row.status}
                showLateButton={detail.showLateButton}
                comment={row.comment}
                saving={savingDates.has(row.date)}
                commentOpen={commentOpenDates.has(row.date)}
                readOnly={readOnly}
                onToggleComment={() => toggleComment(row.date)}
                onCommentBlockedTap={() => showToast('상태를 먼저 선택하세요')}
                onStatusChange={(status) => handleStatusChange(row, status)}
                onCommentCommit={(comment) => handleCommentCommit(row, comment)}
              />
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}
