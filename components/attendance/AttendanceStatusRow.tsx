"use client";

import { useEffect, useRef, useState } from "react";
import type { AttendanceStatus } from "@/app/actions/attendance";

export const STATUS_ORDER: AttendanceStatus[] = [
  "출석",
  "지각",
  "결석",
  "공예배",
];

// idle: 선택 전에도 상태별로 구분되도록 은은한 색(옅은 배경/테두리/글자색)을 준다. active: 선택되면 진하게 채운다.
export const STATUS_STYLE: Record<
  AttendanceStatus,
  { icon: string; idle: string; active: string }
> = {
  출석: {
    icon: "✅",
    idle: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50",
    active:
      "border-emerald-700 bg-emerald-700 text-white/95 dark:border-emerald-800 dark:bg-emerald-800 dark:text-emerald-50",
  },
  지각: {
    icon: "⏰",
    idle: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50",
    active:
      "border-amber-700 bg-amber-700 text-white/95 dark:border-amber-800 dark:bg-amber-800 dark:text-amber-50",
  },
  결석: {
    icon: "❌",
    idle: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50",
    active:
      "border-rose-700 bg-rose-700 text-white/95 dark:border-rose-800 dark:bg-rose-800 dark:text-rose-50",
  },
  공예배: {
    icon: "⭐️",
    idle: "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50",
    active:
      "border-sky-700 bg-sky-700 text-white/95 dark:border-sky-800 dark:bg-sky-800 dark:text-sky-50",
  },
};

const COMMENT_DEBOUNCE_MS = 500;

// 화면에 렌더링할 상태 버튼. `지각` 표시를 끈 경우(app_settings.show_late_button)에도, 이 행이 이미 `지각`으로
// 저장돼 있으면 선택된 채로 계속 보여준다 — 기존 기록이 사라지거나 미체크처럼 보이면 안 된다.
// 다른 상태로 바꾸면 그 행에서도 사라진다. 두 화면이 공유하므로 필터링은 여기서 한 번만 한다.
export function visibleStatuses(showLate: boolean, current: AttendanceStatus | null): AttendanceStatus[] {
  return STATUS_ORDER.filter((s) => s !== "지각" || showLate || current === "지각");
}

// 출석 입력 화면(StudentRow)과 학생 상세 화면(AttendanceHistoryRow)이 공유하는 "상태 버튼 4개 +
// 코멘트 펼침" 한 줄. `leading`에 이름/학년(출석 입력) 또는 날짜(학생 상세)처럼 화면마다 다른 선행
// 라벨을 끼워 넣는다 — 저장 로직·색상 규칙·코멘트 동작은 두 화면이 완전히 동일해야 하므로 여기서만 짠다.
export function AttendanceStatusRow({
  leading,
  status,
  showLateButton,
  comment,
  saving,
  dirty,
  commentOpen,
  readOnly,
  onToggleComment,
  onCommentBlockedTap,
  onStatusChange,
  onCommentCommit,
}: {
  leading: React.ReactNode;
  status: AttendanceStatus | null;
  showLateButton: boolean;
  comment: string | null;
  saving: boolean;
  // true면 로컬에만 반영되고 아직 서버에 보내지 않은 변경이 있다는 뜻(API 호출 절약을 위한 일괄 저장
  // 화면 전용). saving(실시간 저장 중)과는 별개 표시라 둘 다 전달되면 saving을 우선한다.
  dirty?: boolean;
  commentOpen: boolean;
  readOnly: boolean;
  onToggleComment: () => void;
  onCommentBlockedTap: () => void;
  onStatusChange: (status: AttendanceStatus) => void;
  onCommentCommit: (comment: string) => void;
}) {
  const [draft, setDraft] = useState(comment ?? "");
  // comment가 바뀌면(저장 실패로 부모가 롤백했거나, 조회 대상이 교체된 경우) 렌더 중에 draft를 다시
  // 맞춘다 — effect가 아니라 렌더 시점에 동기화해 한 프레임 지연 없이 즉시 반영한다.
  const [syncedComment, setSyncedComment] = useState(comment);
  if (comment !== syncedComment) {
    setSyncedComment(comment);
    setDraft(comment ?? "");
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function scheduleCommit(value: string) {
    setDraft(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => onCommentCommit(value),
      COMMENT_DEBOUNCE_MS,
    );
  }

  function commitNow(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    onCommentCommit(value);
  }

  const unchecked = status === null;
  const commentDisabled = unchecked;

  return (
    <li
      className={`relative rounded-xl border p-2 sm:p-3 ${
        unchecked
          ? "border-red-100 bg-red-50/60 dark:border-red-950/40 dark:bg-red-950/10"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-center gap-x-2 sm:gap-x-3">
        {leading}

        <div className="flex min-w-0 flex-1 gap-1 sm:gap-1.5">
          {visibleStatuses(showLateButton, status).map((s) => {
            const active = status === s;
            const style = STATUS_STYLE[s];
            return (
              <button
                key={s}
                type="button"
                disabled={readOnly}
                onClick={readOnly ? undefined : () => onStatusChange(s)}
                aria-pressed={active}
                className={`flex h-11 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-0.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:px-1 sm:text-xs ${
                  active ? style.active : style.idle
                }`}
              >
                {/* 모바일은 폭이 좁아 글자를 한 줄로 유지하려고 아이콘을 숨긴다(sm 이상에서만 표시). */}
                <span aria-hidden="true" className="hidden sm:inline">
                  {style.icon}
                </span>
                {s}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={commentDisabled ? onCommentBlockedTap : onToggleComment}
          aria-label="코멘트"
          className={`grid h-11 w-10 shrink-0 place-items-center rounded-lg text-lg sm:w-11 ${
            commentDisabled
              ? "cursor-not-allowed text-zinc-300 dark:text-zinc-700"
              : comment
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          💬
        </button>

        {saving ? (
          <span className="absolute right-2 top-1 text-[10px] text-zinc-400">
            저장 중…
          </span>
        ) : (
          dirty && (
            <span
              className="absolute right-2 top-1 text-[10px] text-amber-600 dark:text-amber-400"
              title="아직 서버에 저장되지 않았습니다 — 출석 종료를 누르거나 화면을 벗어나면 저장됩니다"
            >
              변경됨
            </span>
          )
        )}
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
