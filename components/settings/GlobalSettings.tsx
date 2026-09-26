'use client';

import { useState } from 'react';
import { setShowLateButton, setTeachersCanViewAll } from '@/app/actions/teachers';
import type { AppSettings } from '@/app/actions/settings';
import { SectionHeader, Toggle } from './ui';

// 각 항목은 토글 즉시 저장한다. 낙관적으로 먼저 바꿔 보여주고, 실패하면 이전 값으로 되돌리며 토스트를 띄운다.
export function GlobalSettings({
  settings,
  showToast,
}: {
  settings: AppSettings;
  showToast: (message: string) => void;
}) {
  const [values, setValues] = useState(settings);
  const [savingKey, setSavingKey] = useState<keyof AppSettings | null>(null);

  async function change<K extends keyof AppSettings>(
    key: K,
    next: AppSettings[K],
    save: (value: AppSettings[K]) => Promise<{ ok: true } | { ok: false; error: string }>
  ) {
    const previous = values[key];
    setValues((current) => ({ ...current, [key]: next }));
    setSavingKey(key);
    try {
      const result = await save(next);
      if (!result.ok) {
        setValues((current) => ({ ...current, [key]: previous }));
        showToast(result.error);
      }
    } catch (e) {
      console.error('전역 설정 저장 실패:', e);
      setValues((current) => ({ ...current, [key]: previous }));
      showToast('설정을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="mt-6">
      <SectionHeader title="전역 설정" />
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        <li className="flex items-center justify-between gap-3 py-1 pl-3 pr-1">
          <div className="min-w-0">
            <p className="text-sm font-medium">교사 전체보기 허용</p>
            <p className="text-xs text-zinc-500">끄면 교사는 담당 반만 조회·수정할 수 있습니다.</p>
          </div>
          <Toggle
            label="교사 전체보기 허용"
            checked={values.teachersCanViewAll}
            disabled={savingKey === 'teachersCanViewAll'}
            onChange={(next) => change('teachersCanViewAll', next, (value) => setTeachersCanViewAll({ value }))}
          />
        </li>
        <li className="flex items-center justify-between gap-3 py-1 pl-3 pr-1">
          <div className="min-w-0">
            <p className="text-sm font-medium">지각 버튼 표시</p>
            <p className="text-xs text-zinc-500">끄면 출석 입력·학생 상세에서 지각 버튼이 사라집니다. 기존 기록은 유지됩니다.</p>
          </div>
          <Toggle
            label="지각 버튼 표시"
            checked={values.showLateButton}
            disabled={savingKey === 'showLateButton'}
            onChange={(next) => change('showLateButton', next, (value) => setShowLateButton({ value }))}
          />
        </li>
      </ul>
    </section>
  );
}
