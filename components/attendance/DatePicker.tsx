'use client';

import { useMemo, useState } from 'react';
import { adjacentSunday, calendarMonthGrid, formatDateLabel, isSunday } from '@/lib/date';
import { Sheet } from './Sheet';

const WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

export function DatePicker({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => Number(date.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(date.slice(5, 7)));

  const grid = useMemo(() => calendarMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function openSheet() {
    setViewYear(Number(date.slice(0, 4)));
    setViewMonth(Number(date.slice(5, 7)));
    setOpen(true);
  }

  function changeMonth(delta: number) {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  function selectDay(day: string) {
    onChange(day);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange(adjacentSunday(date, -1))}
        aria-label="이전 일요일"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={openSheet}
        className="rounded-lg px-2 py-1.5 text-base font-semibold tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {formatDateLabel(date)}
      </button>
      <button
        type="button"
        onClick={() => onChange(adjacentSunday(date, 1))}
        aria-label="다음 일요일"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        ›
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="날짜 선택">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="이전 달"
            className="rounded-lg px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ‹
          </button>
          <span className="text-sm font-medium">
            {viewYear}.{String(viewMonth).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="다음 달"
            className="rounded-lg px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-400">
          {WEEKDAY_HEADERS.map((w) => (
            <div key={w} className={w === '일' ? 'text-red-400' : ''}>
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((cell) => {
            const selected = cell.date === date;
            const sunday = isSunday(cell.date);
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => selectDay(cell.date)}
                className={[
                  'aspect-square rounded-lg text-sm',
                  cell.inMonth ? '' : 'text-zinc-300 dark:text-zinc-600',
                  sunday && cell.inMonth && !selected ? 'bg-red-50 dark:bg-red-950/30' : '',
                  selected
                    ? 'bg-sky-700 font-semibold text-white/95 dark:bg-sky-800 dark:text-sky-50'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                ].join(' ')}
              >
                {Number(cell.date.slice(8, 10))}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
