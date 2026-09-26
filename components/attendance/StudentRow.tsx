'use client';

import Link from 'next/link';
import type { AttendanceStatus, AttendanceViewRow } from '@/app/actions/attendance';
import { AttendanceStatusRow } from './AttendanceStatusRow';

export function StudentRow({
  row,
  showClassTag,
  saving,
  commentOpen,
  readOnly,
  onToggleComment,
  onCommentBlockedTap,
  onStatusChange,
  onCommentCommit,
}: {
  row: AttendanceViewRow;
  showClassTag: boolean;
  saving: boolean;
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
        <div className="min-w-0 flex-1 sm:flex-none sm:basis-40">
          <p className="text-xs text-zinc-400">
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
      comment={row.comment}
      saving={saving}
      commentOpen={commentOpen}
      readOnly={readOnly}
      onToggleComment={onToggleComment}
      onCommentBlockedTap={onCommentBlockedTap}
      onStatusChange={onStatusChange}
      onCommentCommit={onCommentCommit}
    />
  );
}
