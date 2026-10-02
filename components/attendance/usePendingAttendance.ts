'use client';

import { useCallback, useRef, useState } from 'react';

// 상태 버튼/코멘트 변경을 탭마다 즉시 저장하지 않고 쌓아두는 버퍼(API 호출 절약). 실제 서버 전송
// 시점(반/날짜/탭 전환, 화면 이탈, 출석 종료)은 쓰는 쪽(StudentAttendancePanel/TeacherAttendancePanel)이
// 정하고, 여기서는 "무엇이 아직 안 보내졌는지"만 관리한다. id는 studentId 또는 teacherId.
export function usePendingAttendance<T>() {
  const pendingRef = useRef<Map<string, T>>(new Map());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  const markDirty = useCallback((id: string, entry: T) => {
    pendingRef.current.set(id, entry);
    setDirtyIds((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);

  const getPendingEntries = useCallback((): T[] => [...pendingRef.current.values()], []);

  const clearPending = useCallback(() => {
    pendingRef.current.clear();
    setDirtyIds(new Set());
  }, []);

  return { dirtyIds, markDirty, getPendingEntries, clearPending };
}

// 탭이 백그라운드로 가거나(다른 앱 전환, 화면 잠금) 페이지가 사라질 때(닫기·새로고침·다른 주소로 이동)
// 대기 중인 변경분을 흘려보낸다. 이 시점엔 Server Action(fetch) 응답을 기다릴 수 없어 신뢰할 수 없고,
// sendBeacon만 페이지가 사라져도 브라우저가 전송을 보장한다 — 호출부가 getPendingEntries로 읽은 값을
// sendBeacon으로 쏘는 함수를 넘긴다.
export function registerAttendanceBeaconFlush(flush: () => void): () => void {
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flush();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', flush);
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', flush);
  };
}
