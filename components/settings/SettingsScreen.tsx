'use client';

import { useState } from 'react';
import type { MasterManagementData } from '@/app/actions/settings';
import { ClassesTab } from './ClassesTab';
import { GlobalSettings } from './GlobalSettings';
import { StudentsTab } from './StudentsTab';
import { TeachersTab } from './TeachersTab';
import { useToast } from './ui';

const TABS = [
  { key: 'teachers', label: '교사' },
  { key: 'students', label: '학생' },
  { key: 'classes', label: '반' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// 마스터 관리(교사·학생·반) + 전역 설정. 데이터는 서버 페이지가 내려주고, 각 액션이 revalidatePath('/settings')로
// 저장 후 이 props를 새로 받아오게 한다(화면이 로컬 사본을 들고 있지 않는다).
export function SettingsScreen({ data }: { data: MasterManagementData }) {
  const [tab, setTab] = useState<TabKey>('teachers');
  const toast = useToast();

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div role="tablist" aria-label="마스터 관리" className="mx-auto flex w-full max-w-3xl gap-1 px-4 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`h-11 flex-1 rounded-lg text-sm font-semibold transition sm:flex-none sm:px-8 ${
                tab === t.key
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-3 pb-16"
      >
        {tab === 'teachers' && (
          <>
            <TeachersTab
              teachers={data.teachers}
              invites={data.invites}
              classes={data.classes}
              currentTeacherId={data.currentTeacherId}
              showToast={toast.show}
            />
            <GlobalSettings settings={data.settings} showToast={toast.show} />
          </>
        )}
        {tab === 'students' && (
          <StudentsTab students={data.students} classes={data.classes} showToast={toast.show} />
        )}
        {tab === 'classes' && <ClassesTab classes={data.classes} showToast={toast.show} />}
      </div>

      {toast.node}
    </div>
  );
}
