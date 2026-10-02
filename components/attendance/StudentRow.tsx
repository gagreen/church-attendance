'use client';

import Link from 'next/link';
import type { AttendanceStatus, AttendanceViewRow } from '@/app/actions/attendance';
import { AttendanceStatusRow } from './AttendanceStatusRow';

export function StudentRow({
  row,
  showClassTag,
  showLateButton,
  saving,
  dirty,
  commentOpen,
  readOnly,
  onToggleComment,
  onCommentBlockedTap,
  onStatusChange,
  onCommentCommit,
}: {
  row: AttendanceViewRow;
  showClassTag: boolean;
  showLateButton: boolean;
  saving: boolean;
  dirty?: boolean;
  commentOpen: boolean;
  readOnly: boolean;
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
            {row.grade ?? '미지정'}
            {showClassTag ? ` · ${row.className}` : ''}
          </p>
          <Link
            href={`/students/${row.studentId}`}
            className="block truncate text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            {row.studentName}
          </Link>
        </div>
      }
      status={row.status}
      showLateButton={showLateButton}
      comment={row.comment}
      saving={saving}
      dirty={dirty}
      commentOpen={commentOpen}
      readOnly={readOnly}
      onToggleComment={onToggleComment}
      onCommentBlockedTap={onCommentBlockedTap}
      onStatusChange={onStatusChange}
      onCommentCommit={onCommentCommit}
    />
  );
}
