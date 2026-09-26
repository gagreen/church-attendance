'use client';

import { useState } from 'react';
import { Sheet } from '@/components/attendance/Sheet';
import { createClass, updateClass } from '@/app/actions/classes';
import type { ClassAdminRow } from '@/app/actions/settings';
import { Field, SectionHeader, Toggle, inputClass, primaryButtonClass, secondaryButtonClass, useAction } from './ui';

export function ClassesTab({
  classes,
  showToast,
}: {
  classes: ClassAdminRow[];
  showToast: (message: string) => void;
}) {
  const { pending, run } = useAction(showToast);
  // 'new' = 새 반 등록, ClassAdminRow = 이름 수정, null = 닫힘
  const [form, setForm] = useState<'new' | ClassAdminRow | null>(null);

  return (
    <>
      <SectionHeader
        title={`반 (${classes.length})`}
        action={
          <button type="button" onClick={() => setForm('new')} className={secondaryButtonClass}>
            + 새 반 등록
          </button>
        }
      />
      {classes.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">등록된 반이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {classes.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl border p-3 ${
                c.isActive
                  ? 'border-zinc-200 dark:border-zinc-800'
                  : 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold">
                  {c.name}
                  <span className="ml-1.5 text-xs font-normal text-zinc-500">학생 {c.studentCount}명</span>
                </p>
                <Toggle
                  label={`${c.name} 활성`}
                  checked={c.isActive}
                  disabled={pending}
                  onChange={(isActive) => run(() => updateClass({ classId: c.id, isActive }))}
                />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs text-zinc-500">
                  담당 교사: {c.teachers.length > 0 ? c.teachers.map((t) => t.name).join(', ') : '없음'}
                </p>
                <button type="button" onClick={() => setForm(c)} className={secondaryButtonClass}>
                  이름 수정
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-zinc-400">
        비활성 반은 반 선택에서만 숨겨지고, 소속 학생과 출석 기록은 그대로 유지됩니다.
      </p>

      {form && (
        <ClassFormSheet
          key={form === 'new' ? 'new' : form.id}
          target={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}

function ClassFormSheet({
  target,
  onClose,
  showToast,
}: {
  target: ClassAdminRow | null;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const { pending, run } = useAction(showToast);
  const [name, setName] = useState(target?.name ?? '');
  const canSubmit = name.trim() !== '' && name.trim() !== target?.name && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await run(() =>
      target ? updateClass({ classId: target.id, name }) : createClass({ name })
    );
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={target ? '반 이름 수정' : '새 반 등록'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="반 이름">
          <input
            type="text"
            autoFocus
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
          {pending ? '저장 중…' : target ? '저장' : '등록'}
        </button>
      </form>
    </Sheet>
  );
}
