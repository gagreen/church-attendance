'use client';

import { useState } from 'react';
import type { ClassOption } from '@/app/actions/attendance';
import { Sheet } from './Sheet';

export function ClassPicker({
  classOptions,
  classId,
  onChange,
}: {
  classOptions: ClassOption[];
  classId: string;
  onChange: (classId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    classId === 'all' ? '전체' : (classOptions.find((c) => c.id === classId)?.name ?? '전체');

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-base font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {selectedLabel}
        <span aria-hidden="true" className="text-xs text-zinc-400">
          ▾
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="반 선택">
        <ul className="flex flex-col gap-1">
          <li>
            <button
              type="button"
              onClick={() => select('all')}
              className={`w-full rounded-lg px-3 py-3 text-left text-sm ${
                classId === 'all'
                  ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              전체
            </button>
          </li>
          {classOptions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => select(c.id)}
                className={`w-full rounded-lg px-3 py-3 text-left text-sm ${
                  classId === c.id
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {c.name} <span className="text-zinc-400">({c.studentCount})</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
