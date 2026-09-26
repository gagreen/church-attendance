'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveResult } from '@/lib/actionResult';

export const ROLE_LABELS = { admin: '관리자', teacher: '교사', pastor: '목사님' } as const;

export const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900';
export const primaryButtonClass =
  'rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
export const secondaryButtonClass =
  'rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800';

// 토스트: 기존 화면들(AttendanceScreen 등)과 같은 모양·3초 표시.
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  const node = message ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
      >
        {message}
      </div>
    </div>
  ) : null;

  return { show, node };
}

// Server Action 호출 공통 처리: 진행 중 표시, 실패(ok:false)·예외(네트워크 오류 등) 모두 토스트로 알린다.
// 성공하면 true를 돌려주므로 호출부는 시트 닫기 같은 후속 동작만 하면 된다. 실패 시 폼 값은 그대로 남는다.
export function useAction(showToast: (message: string) => void) {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (task: () => Promise<SaveResult>): Promise<boolean> => {
      setPending(true);
      try {
        const result = await task();
        if (!result.ok) {
          showToast(result.error);
          return false;
        }
        return true;
      } catch (e) {
        console.error('마스터 관리 요청 실패:', e);
        showToast('요청에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.');
        return false;
      } finally {
        setPending(false);
      }
    },
    [showToast]
  );

  return { pending, run };
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // 터치 영역은 44px 이상 확보하고, 보이는 스위치는 안쪽에 작게 그린다.
      className="grid h-11 w-14 shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
          checked ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

// 담당 반 다중 선택. 활성 반 + (이미 선택돼 있는) 비활성 반만 보여준다 — 비활성 반은 새로 고를 수 없지만
// 기존 담당은 눈에 보여야 해제할 수 있다.
export function ClassCheckboxes({
  classes,
  selected,
  onChange,
  disabled,
}: {
  classes: { id: string; name: string; isActive: boolean }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const visible = classes.filter((c) => c.isActive || selected.includes(c.id));
  if (visible.length === 0) return <p className="text-xs text-zinc-400">등록된 반이 없습니다.</p>;

  return (
    <ul className="grid grid-cols-2 gap-1.5">
      {visible.map((c) => {
        const checked = selected.includes(c.id);
        return (
          <li key={c.id}>
            <label
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                checked
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(checked ? selected.filter((id) => id !== c.id) : [...selected, c.id])}
              />
              <span className="truncate">
                {c.name}
                {!c.isActive && <span className="text-zinc-400"> (비활성)</span>}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-zinc-500">{title}</h2>
      {action}
    </div>
  );
}
