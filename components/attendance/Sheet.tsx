'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// 모바일: 하단 바텀시트, PC(sm 이상): 중앙 팝업. 반/날짜 선택 공용 오버레이.
// document.body로 포털링한다 — 컨텍스트 바의 backdrop-blur(backdrop-filter)가 자손 fixed 요소의
// 기준 박스를 뷰포트가 아닌 그 바 자신으로 바꿔서, 포털 없이는 시트가 바 안에 갇혀 잘려 보인다.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-sm sm:rounded-2xl dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
