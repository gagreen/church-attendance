'use client';

import { useEffect, useRef, useState } from 'react';
import type { AttendanceStatus } from '@/app/actions/attendance';

export const STATUS_ORDER: AttendanceStatus[] = ['출석', '지각', '결석', '공예배'];

export const STATUS_STYLE: Record<AttendanceStatus, { icon: string; active: string }> = {
  출석: { icon: '✓', active: 'border-green-600 bg-green-600 text-white' },
  지각: { icon: '⏰', active: 'border-yellow-500 bg-yellow-500 text-white' },
  결석: { icon: '✕', active: 'border-red-600 bg-red-600 text-white' },
  공예배: { icon: '★', active: 'border-blue-600 bg-blue-600 text-white' },
};

const COMMENT_DEBOUNCE_MS = 500;

// 출석 입력 화면(StudentRow)과 학생 상세 화면(AttendanceHistoryRow)이 공유하는 "상태 버튼 4개 +
// 코멘트 펼침" 한 줄. `leading`에 이름/학년(출석 입력) 또는 날짜(학생 상세)처럼 화면마다 다른 선행
// 라벨을 끼워 넣는다 — 저장 로직·색상 규칙·코멘트 동작은 두 화면이 완전히 동일해야 하므로 여기서만 짠다.
export function AttendanceStatusRow({
  leading,
  status,
  comment,
  saving,
  commentOpen,
  readOnly,
  onToggleComment,
  onCommentBlockedTap,
  onStatusChange,
  onCommentCommit,
}: {
  leading: React.ReactNode;
  status: AttendanceStatus | null;
  comment: string | null;
  saving: boolean;
  commentOpen: boolean;
  readOnly: boolean;
  onToggleComment: () => void;
  onCommentBlockedTap: () => void;
  onStatusChange: (status: AttendanceStatus) => void;
  onCommentCommit: (comment: string) => void;
}) {
  const [draft, setDraft] = useState(comment ?? '');
  // comment가 바뀌면(저장 실패로 부모가 롤백했거나, 조회 대상이 교체된 경우) 렌더 중에 draft를 다시
  // 맞춘다 — effect가 아니라 렌더 시점에 동기화해 한 프레임 지연 없이 즉시 반영한다.
  const [syncedComment, setSyncedComment] = useState(comment);
  if (comment !== syncedComment) {
    setSyncedComment(comment);
    setDraft(comment ?? '');
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  function scheduleCommit(value: string) {
    setDraft(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommentCommit(value), COMMENT_DEBOUNCE_MS);
  }

  function commitNow(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    onCommentCommit(value);
  }

  const unchecked = status === null;
  const commentDisabled = unchecked;

  return (
    <li
      className={`rounded-xl border p-3 ${
        unchecked
          ? 'border-red-100 bg-red-50/60 dark:border-red-950/40 dark:bg-red-950/10'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        {leading}

        <div className="flex flex-1 gap-1.5">
          {STATUS_ORDER.map((s) => {
            const active = status === s;
            const style = STATUS_STYLE[s];
            return (
              <button
                key={s}
                type="button"
                disabled={readOnly}
                onClick={readOnly ? undefined : () => onStatusChange(s)}
                aria-pressed={active}
                className={`flex h-11 flex-1 items-center justify-center gap-1 rounded-lg border text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? style.active
                    : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <span aria-hidden="true">{style.icon}</span>
                {s}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={commentDisabled ? onCommentBlockedTap : onToggleComment}
          aria-label="코멘트"
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg ${
            commentDisabled
              ? 'cursor-not-allowed text-zinc-300 dark:text-zinc-700'
              : comment
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          💬
        </button>

        {saving && <span className="text-xs text-zinc-400">저장 중…</span>}
      </div>

      {commentOpen && !commentDisabled && (
        <div className="mt-2">
          <input
            type="text"
            value={draft}
            disabled={readOnly}
            onChange={(e) => scheduleCommit(e.target.value)}
            onBlur={(e) => commitNow(e.target.value)}
            placeholder="코멘트 (예: 병원 진료로 늦음)"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:disabled:bg-zinc-950"
          />
        </div>
      )}
    </li>
  );
}
