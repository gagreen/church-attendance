'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getClassReview, saveClassReview, type ClassReview } from '@/app/actions/weeklyReview';
import { formatDateLabel, formatDateTimeLabel, sundayOfWeek } from '@/lib/date';

const REVIEW_DEBOUNCE_MS = 800;
const BODY_MAX_LENGTH = 3000;
const COUNTER_THRESHOLD = 2700; // 한도(3000)에 가까워지면 글자 수 카운터를 보여준다.

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// 출석 입력 화면(학생 탭, 반 하나 선택 시) 하단의 반별 주간 총평. docs/screens/weekly-review.md 화면 1.
export function WeeklyReviewPanel({
  classId,
  className,
  date,
  readOnly, // 목사님: 총평은 읽기만, 답글도 이 화면에서는 읽기 전용 목록만
}: {
  classId: string;
  className: string;
  date: string;
  readOnly: boolean;
}) {
  const [review, setReview] = useState<ClassReview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [draft, setDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [repliesOpen, setRepliesOpen] = useState(false);
  const requestId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBodyRef = useRef<string | null>(null); // 저장 대기 중인(디바운스 타이머가 아직 안 끝난) 본문

  const load = useCallback((targetClassId: string, targetDate: string) => {
    const myRequestId = ++requestId.current;
    setLoadState('loading');
    setRepliesOpen(false);
    getClassReview({ classId: targetClassId, date: targetDate })
      .then((data) => {
        if (myRequestId !== requestId.current) return;
        setReview(data);
        setDraft(data.body);
        setSaveState('idle');
        setLoadState('ready');
      })
      .catch((e) => {
        if (myRequestId !== requestId.current) return;
        console.error('총평 조회 실패:', e);
        setLoadState('error');
      });
  }, []);

  // 반/날짜(주)가 바뀔 때: 이전 반의 저장 대기 중인 입력이 있으면 전환 전에 먼저 저장하고(cleanup은 이전
  // 렌더의 classId/date를 그대로 참조한다), 새 반/날짜의 총평을 불러온다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(classId, date);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingBodyRef.current !== null) {
        const body = pendingBodyRef.current;
        pendingBodyRef.current = null;
        saveClassReview({ classId, date, body }).catch((e) => console.error('총평 저장 실패:', e));
      }
    };
  }, [classId, date, load]);

  function commitNow(value: string) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingBodyRef.current = null;
    setSaveState('saving');
    saveClassReview({ classId, date, body: value })
      .then((result) => {
        if (result.ok) {
          setReview((current) =>
            current
              ? { ...current, lastModifiedByName: result.lastModifiedByName, lastModifiedAt: result.lastModifiedAt }
              : current
          );
          setSaveState('saved');
        } else {
          setSaveState('error');
        }
      })
      .catch(() => setSaveState('error'));
  }

  function scheduleCommit(value: string) {
    setDraft(value);
    pendingBodyRef.current = value;
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commitNow(value), REVIEW_DEBOUNCE_MS);
  }

  const weekStart = sundayOfWeek(date);

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">
        이번 주 총평 · {className}
        <span className="ml-1.5 font-normal text-zinc-400">{formatDateLabel(weekStart)} 주</span>
      </h2>

      {loadState === 'loading' && <div className="mt-2 h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}

      {loadState === 'error' && (
        <div className="mt-2 flex items-center justify-between gap-2 text-sm text-red-700 dark:text-red-300">
          <span>총평을 불러오지 못했습니다.</span>
          <button
            type="button"
            onClick={() => load(classId, date)}
            className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
          >
            다시 시도
          </button>
        </div>
      )}

      {loadState === 'ready' && review && (
        <>
          {readOnly ? (
            <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-2.5 text-sm dark:bg-zinc-900">
              {review.body || <span className="text-zinc-400">총평이 아직 없습니다.</span>}
            </p>
          ) : (
            <>
              <textarea
                value={draft}
                maxLength={BODY_MAX_LENGTH}
                onChange={(e) => scheduleCommit(e.target.value)}
                onBlur={(e) => commitNow(e.target.value)}
                placeholder="공과 / 반모임 / 기도제목"
                rows={4}
                className="mt-2 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {saveState === 'saving' && '저장 중…'}
                  {saveState === 'saved' && review.lastModifiedByName && review.lastModifiedAt && (
                    <>
                      저장됨 · 마지막 수정 {review.lastModifiedByName} {formatDateTimeLabel(review.lastModifiedAt)}
                    </>
                  )}
                  {saveState === 'error' && (
                    <button type="button" onClick={() => commitNow(draft)} className="text-red-600 hover:underline dark:text-red-400">
                      저장 실패 · 다시 시도
                    </button>
                  )}
                </span>
                {draft.length >= COUNTER_THRESHOLD && (
                  <span>
                    {draft.length}/{BODY_MAX_LENGTH}
                  </span>
                )}
              </div>
            </>
          )}

          {review.replies.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setRepliesOpen((v) => !v)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {repliesOpen ? '▾' : '▸'} 목사님 답글 {review.replies.length}
              </button>
              {repliesOpen && (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {review.replies.map((r) => (
                    <li key={r.id} className="rounded-lg bg-zinc-50 p-2 text-sm dark:bg-zinc-900">
                      <p className="whitespace-pre-wrap break-words">{r.body}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {r.authorName} · {formatDateTimeLabel(r.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
