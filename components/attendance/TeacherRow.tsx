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
          <p className="truncate text-sm font-medium">{row.teacherName}</p>
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
