'use client';

import { useState } from 'react';
import { Sheet } from '@/components/attendance/Sheet';
import { createStudent, updateStudent, type CreateStudentParams } from '@/app/actions/students';
import type { ClassAdminRow, StudentAdminRow } from '@/app/actions/settings';
import { todayInKST } from '@/lib/date';
import { GRADE_OPTIONS } from '@/lib/gradeOptions';
import { Field, SectionHeader, Toggle, inputClass, primaryButtonClass, secondaryButtonClass, useAction } from './ui';

export function StudentsTab({
  students,
  classes,
  showToast,
}: {
  students: StudentAdminRow[];
  classes: ClassAdminRow[];
  showToast: (message: string) => void;
}) {
  const { pending, run } = useAction(showToast);
  // 'new' = 새 학생 등록, StudentAdminRow = 수정, null = 닫힘
  const [form, setForm] = useState<'new' | StudentAdminRow | null>(null);
  const noActiveClass = !classes.some((c) => c.isActive);

  return (
    <>
      <SectionHeader
        title={`학생 (${students.filter((s) => s.isActive).length}명 활성)`}
        action={
          <button
            type="button"
            onClick={() => (noActiveClass ? showToast('먼저 반 탭에서 반을 등록해 주세요.') : setForm('new'))}
            className={secondaryButtonClass}
          >
            + 새 학생 등록
          </button>
        }
      />
      {students.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">등록된 학생이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {students.map((s) => (
            <li
              key={s.id}
              className={`rounded-xl border p-3 ${
                s.isActive
                  ? 'border-zinc-200 dark:border-zinc-800'
                  : 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {s.className} · {s.grade ?? '학년 미지정'} · 등록 {s.enrolledDate}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => setForm(s)} className={secondaryButtonClass}>
                    수정
                  </button>
                  <Toggle
                    label={`${s.name} 활성`}
                    checked={s.isActive}
                    disabled={pending}
                    onChange={(isActive) => run(() => updateStudent({ studentId: s.id, isActive }))}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <StudentFormSheet
          key={form === 'new' ? 'new' : form.id}
          target={form === 'new' ? null : form}
          classes={classes}
          onClose={() => setForm(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}

function StudentFormSheet({
  target,
  classes,
  onClose,
  showToast,
}: {
  target: StudentAdminRow | null;
  classes: ClassAdminRow[];
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const { pending, run } = useAction(showToast);
  const activeClasses = classes.filter((c) => c.isActive);
  const [name, setName] = useState(target?.name ?? '');
  const [classId, setClassId] = useState(target?.classId ?? activeClasses[0]?.id ?? '');
  const [grade, setGrade] = useState(target?.grade ?? '');
  const [enrolledDate, setEnrolledDate] = useState(() => todayInKST());

  // 수정 중인 학생의 현재 반이 비활성이어도 선택지에 남겨서, 반을 건드리지 않고 다른 항목만 저장할 수 있게 한다.
  const classOptions = classes.filter((c) => c.isActive || c.id === target?.classId);

  const dirty = target
    ? name.trim() !== target.name || classId !== target.classId || grade !== (target.grade ?? '')
    : true;
  const canSubmit = name.trim() !== '' && classId !== '' && dirty && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await run(() =>
      target
        ? updateStudent({
            studentId: target.id,
            name,
            classId,
            grade: grade === '' ? null : grade,
          })
        : createStudent({
            name,
            classId,
            grade: grade === '' ? undefined : (grade as CreateStudentParams['grade']),
            enrolledDate,
          })
    );
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={target ? '학생 수정' : '새 학생 등록'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="이름">
          <input
            type="text"
            autoFocus
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="반">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.isActive ? ' (비활성)' : ''}
              </option>
            ))}
          </select>
        </Field>
        {target && classId !== target.classId && (
          <p className="-mt-1 text-xs text-zinc-500">반을 옮겨도 과거 출석 기록은 그 당시 반 기준으로 그대로 남습니다.</p>
        )}
        <Field label="학년">
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass}>
            <option value="">미지정</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        {!target && (
          <Field label="등록일">
            <input
              type="date"
              value={enrolledDate}
              onChange={(e) => setEnrolledDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
        <button type="submit" disabled={!canSubmit || (!target && enrolledDate === '')} className={primaryButtonClass}>
          {pending ? '저장 중…' : target ? '저장' : '등록'}
        </button>
      </form>
    </Sheet>
  );
}
