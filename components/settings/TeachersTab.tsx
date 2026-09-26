'use client';

import { useState } from 'react';
import { Sheet } from '@/components/attendance/Sheet';
import {
  cancelInvite,
  inviteTeacher,
  updateTeacher,
  type UpdateTeacherParams,
} from '@/app/actions/teachers';
import type { ClassAdminRow, TeacherAdminRow, TeacherInviteRow, TeacherRole } from '@/app/actions/settings';
import {
  ClassCheckboxes,
  Field,
  ROLE_LABELS,
  SectionHeader,
  Toggle,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  useAction,
} from './ui';

const ROLES: TeacherRole[] = ['teacher', 'admin', 'pastor'];

function classNames(classIds: string[], classes: ClassAdminRow[]): string {
  const names = classIds.map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean);
  return names.length > 0 ? names.join(', ') : '없음';
}

export function TeachersTab({
  teachers,
  invites,
  classes,
  currentTeacherId,
  showToast,
}: {
  teachers: TeacherAdminRow[];
  invites: TeacherInviteRow[];
  classes: ClassAdminRow[];
  currentTeacherId: string;
  showToast: (message: string) => void;
}) {
  const { pending, run } = useAction(showToast);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<TeacherAdminRow | null>(null);

  async function toggleActive(teacher: TeacherAdminRow, isActive: boolean) {
    // 본인을 끄면 곧바로 접근이 막힌다 — 실수 방지용 확인. (마지막 활성 관리자는 DB 트리거가 막는다.)
    if (teacher.id === currentTeacherId && !isActive) {
      if (!window.confirm('본인 계정을 비활성화하면 더 이상 이 앱에 접근할 수 없습니다. 계속할까요?')) return;
    }
    await run(() => updateTeacher({ teacherId: teacher.id, isActive }));
  }

  async function handleCancelInvite(invite: TeacherInviteRow) {
    if (!window.confirm(`${invite.email} 초대를 취소할까요?`)) return;
    await run(() => cancelInvite({ inviteId: invite.id }));
  }

  return (
    <>
      <section>
        <SectionHeader
          title={`교사 (${teachers.length})`}
          action={
            <button type="button" onClick={() => setInviting(true)} className={secondaryButtonClass}>
              + 새 교사 등록
            </button>
          }
        />
        {teachers.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">등록된 교사가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {teachers.map((t) => (
              <li
                key={t.id}
                className={`rounded-xl border p-3 ${
                  t.isActive
                    ? 'border-zinc-200 dark:border-zinc-800'
                    : 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {t.name}
                      <span className="ml-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {ROLE_LABELS[t.role]}
                      </span>
                      {t.id === currentTeacherId && <span className="ml-1.5 text-[11px] text-zinc-400">(나)</span>}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{t.email}</p>
                  </div>
                  <Toggle
                    label={`${t.name} 활성`}
                    checked={t.isActive}
                    disabled={pending}
                    onChange={(next) => toggleActive(t, next)}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-zinc-500">
                    {t.role === 'teacher' ? `담당 반: ${classNames(t.classIds, classes)}` : ' '}
                  </p>
                  <button type="button" onClick={() => setEditing(t)} className={secondaryButtonClass}>
                    수정
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invites.length > 0 && (
        <section className="mt-6">
          <SectionHeader title={`초대 대기 중 (${invites.length})`} />
          <ul className="flex flex-col gap-2">
            {invites.map((i) => (
              <li key={i.id} className="rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
                <p className="truncate text-sm font-medium">
                  {i.name}
                  <span className="ml-1.5 text-xs font-normal text-zinc-500">{ROLE_LABELS[i.role]}</span>
                </p>
                <p className="truncate text-xs text-zinc-500">{i.email}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-zinc-500">
                    {i.role === 'teacher' ? `담당: ${classNames(i.classIds, classes)} · ` : ''}아직 로그인 안 함
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleCancelInvite(i)}
                    className={secondaryButtonClass}
                  >
                    초대 취소
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inviting && <InviteSheet classes={classes} onClose={() => setInviting(false)} showToast={showToast} />}
      {editing && (
        <EditTeacherSheet
          key={editing.id}
          teacher={editing}
          classes={classes}
          isSelf={editing.id === currentTeacherId}
          onClose={() => setEditing(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}

function InviteSheet({
  classes,
  onClose,
  showToast,
}: {
  classes: ClassAdminRow[];
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const { pending, run } = useAction(showToast);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<TeacherRole>('teacher');
  const [classIds, setClassIds] = useState<string[]>([]);

  const canSubmit = email.trim() !== '' && name.trim() !== '' && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await run(() => inviteTeacher({ email, name, role, classIds }));
    if (ok) {
      showToast('초대했습니다. 해당 구글 계정으로 로그인하면 자동으로 활성화됩니다.');
      onClose();
    }
  }

  return (
    <Sheet open onClose={onClose} title="새 교사 등록">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="구글 이메일">
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@gmail.com"
            className={inputClass}
          />
        </Field>
        <Field label="이름">
          <input
            type="text"
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="역할">
          <select value={role} onChange={(e) => setRole(e.target.value as TeacherRole)} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        {role === 'teacher' && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">담당 반</span>
            <ClassCheckboxes classes={classes} selected={classIds} onChange={setClassIds} />
          </div>
        )}
        <p className="text-xs text-zinc-500">
          등록하면 초대 대기 상태가 되고, 이 이메일의 구글 계정으로 처음 로그인할 때 교사로 활성화됩니다.
        </p>
        <button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
          {pending ? '등록 중…' : '등록'}
        </button>
      </form>
    </Sheet>
  );
}

function EditTeacherSheet({
  teacher,
  classes,
  isSelf,
  onClose,
  showToast,
}: {
  teacher: TeacherAdminRow;
  classes: ClassAdminRow[];
  isSelf: boolean;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const { pending, run } = useAction(showToast);
  const [role, setRole] = useState<TeacherRole>(teacher.role);
  const [classIds, setClassIds] = useState<string[]>(teacher.classIds);

  const roleChanged = role !== teacher.role;
  const classesChanged =
    classIds.length !== teacher.classIds.length || classIds.some((id) => !teacher.classIds.includes(id));
  const dirty = roleChanged || (role === 'teacher' && classesChanged);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || pending) return;
    if (isSelf && roleChanged && role !== 'admin') {
      if (!window.confirm('본인의 관리자 권한을 내려놓으면 이 화면에 더 이상 접근할 수 없습니다. 계속할까요?')) return;
    }

    const params: UpdateTeacherParams = { teacherId: teacher.id };
    if (roleChanged) params.role = role;
    if (role === 'teacher' && classesChanged) params.classIds = classIds;

    if (await run(() => updateTeacher(params))) onClose();
  }

  return (
    <Sheet open onClose={onClose} title="교사 수정">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">{teacher.name}</p>
          <p className="text-xs text-zinc-500">{teacher.email}</p>
        </div>
        <Field label="역할">
          <select value={role} onChange={(e) => setRole(e.target.value as TeacherRole)} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        {role === 'teacher' && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">담당 반</span>
            <ClassCheckboxes classes={classes} selected={classIds} onChange={setClassIds} />
          </div>
        )}
        <button type="submit" disabled={!dirty || pending} className={primaryButtonClass}>
          {pending ? '저장 중…' : '저장'}
        </button>
      </form>
    </Sheet>
  );
}
