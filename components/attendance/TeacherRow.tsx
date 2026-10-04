'use client';

import type { AttendanceStatus } from '@/app/actions/attendance';
import type { TeacherAttendanceRow } from '@/app/actions/teacherAttendance';
import { AttendanceStatusRow } from './AttendanceStatusRow';

export function TeacherRow({
  row,
  showLateButton,
  saving,
  dirty,
  commentOpen,
  onToggleComment,
  onCommentBlockedTap,
  onStatusChange,
  onCommentCommit,
}: {
  row: TeacherAttendanceRow;
  showLateButton: boolean;
  saving: boolean;
  dirty?: boolean;
  commentOpen: boolean;
  onToggleComment: () => void;
  onCommentBlockedTap: () => void;
  onStatusChange: (status: AttendanceStatus) => void;
  onCommentCommit: (comment: string) => void;
}) {
  return (
    <AttendanceStatusRow
      leading={
        <div className="w-16 shrink-0 sm:w-40">
          <p className="truncate text-xs text-zinc-400">
            {row.classNames.length > 0 ? row.classNames.join(', ') : '담당 반 없음'}
          </p>
          <p className="flex items-center gap-1 text-sm font-medium">
            <span className="truncate">{row.teacherName}</span>
            {row.isPending && (
              <span
                className="shrink-0 rounded bg-zinc-100 px-1 text-[10px] font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                title="아직 Google 로그인을 하지 않은 초대 교사입니다. 첫 로그인 시 이 기록이 그대로 옮겨집니다."
              >
                초대 대기
              </span>
            )}
          </p>
        </div>
      }
      status={row.status}
      showLateButton={showLateButton}
      comment={row.comment}
      saving={saving}
      dirty={dirty}
      commentOpen={commentOpen}
      // 목사님도 교사 출석은 입력할 수 있다(docs/screens/teacher-attendance.md) — 화면 전체 readOnly와 무관.
      readOnly={false}
      onToggleComment={onToggleComment}
      onCommentBlockedTap={onCommentBlockedTap}
      onStatusChange={onStatusChange}
      onCommentCommit={onCommentCommit}
    />
  );
}
