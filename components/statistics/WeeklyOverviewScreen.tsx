'use client';

import { useCallback, useRef, useState } from 'react';
import {
  addReviewReply,
  deleteReviewReply,
  getWeeklyOverview,
  type WeeklyClassCard,
  type WeeklyOverview,
  type WeeklyOverviewInitialContext,
} from '@/app/actions/weeklyReview';
import { addDays, formatDateDotted, formatDateLabel, formatDateTimeLabel, thisWeekSundayInKST } from '@/lib/date';
import { ClassPicker } from '@/components/attendance/ClassPicker';

type LoadState = 'loading' | 'ready' | 'error';

function CountsLine({ counts }: { counts: WeeklyClassCard['counts'] }) {
  return (
    <span className="tabular-nums">
      출석 {counts.출석} · 지각 {counts.지각} · 결석 {counts.결석} · 공예배 {counts.공예배}
    </span>
  );
}

// 통계 > 주별 모아보기(기본 화면). docs/screens/weekly-review.md 화면 2.
export function WeeklyOverviewScreen({
  initialContext,
  initialResult,
  isPastor,
}: {
  initialContext: WeeklyOverviewInitialContext;
  initialResult: WeeklyOverview;
  isPastor: boolean;
}) {
  const thisWeek = thisWeekSundayInKST();
  const [classId, setClassId] = useState('all');
  const [weekStart, setWeekStart] = useState(initialContext.defaultWeekStart);
  const [result, setResult] = useState(initialResult);
  const [loadState, setLoadState] = useState<LoadState>('ready');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReviewIds, setSubmittingReviewIds] = useState<Set<string>>(new Set());
  const [deletingReplyIds, setDeletingReplyIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback((targetClassId: string, targetWeekStart: string) => {
    const myRequestId = ++requestId.current;
    setLoadState((prev) => (prev === 'ready' ? prev : 'loading'));
    getWeeklyOverview({ classId: targetClassId, weekStart: targetWeekStart })
      .then((data) => {
        if (myRequestId !== requestId.current) return;
        setResult(data);
        setLoadState('ready');
      })
      .catch((e) => {
        if (myRequestId !== requestId.current) return;
        console.error('주별 모아보기 조회 실패:', e);
        setLoadState('error');
      });
  }, []);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3000);
  }

  function changeClass(nextClassId: string) {
    setClassId(nextClassId);
    load(nextClassId, weekStart);
  }

  function changeWeek(nextWeekStart: string) {
    setWeekStart(nextWeekStart);
    load(classId, nextWeekStart);
  }

  function handleReplySubmit(reviewId: string) {
    const body = (replyDrafts[reviewId] ?? '').trim();
    if (body === '' || submittingReviewIds.has(reviewId)) return;
    setSubmittingReviewIds((current) => new Set(current).add(reviewId));
    addReviewReply({ reviewId, body })
      .then((res) => {
        if (res.ok) {
          setReplyDrafts((current) => ({ ...current, [reviewId]: '' }));
          load(classId, weekStart);
        } else {
          showToast(res.error);
        }
      })
      .catch(() => showToast('답글 등록에 실패했습니다. 다시 시도해 주세요.'))
      .finally(() =>
        setSubmittingReviewIds((current) => {
          const next = new Set(current);
          next.delete(reviewId);
          return next;
        })
      );
  }

  function handleReplyDelete(replyId: string) {
    if (!window.confirm('이 답글을 삭제할까요? 삭제한 답글은 되돌릴 수 없습니다.')) return;
    setDeletingReplyIds((current) => new Set(current).add(replyId));
    deleteReviewReply({ replyId })
      .then((res) => {
        if (res.ok) load(classId, weekStart);
        else showToast(res.error);
      })
      .catch(() => showToast('삭제에 실패했습니다. 다시 시도해 주세요.'))
      .finally(() =>
        setDeletingReplyIds((current) => {
          const next = new Set(current);
          next.delete(replyId);
          return next;
        })
      );
  }

  const busy = loadState === 'loading';

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => changeWeek(addDays(weekStart, -7))}
              aria-label="이전 주"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ‹
            </button>
            <span className="px-1 text-base font-semibold tabular-nums">{formatDateLabel(weekStart)} 주</span>
            <button
              type="button"
              onClick={() => changeWeek(addDays(weekStart, 7))}
              disabled={weekStart >= thisWeek}
              aria-label="다음 주"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              ›
            </button>
          </div>
          <ClassPicker classOptions={initialContext.classOptions} classId={classId} onChange={changeClass} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-3">
        {loadState === 'error' && (
          <div className="mb-3 flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
            <p>주별 모아보기를 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => load(classId, weekStart)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"
            >
              다시 시도
            </button>
          </div>
        )}

        {loadState === 'loading' && result.cards.length === 0 && (
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            ))}
          </ul>
        )}

        {loadState !== 'error' && loadState !== 'loading' && result.cards.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">조회할 수 있는 반이 없습니다.</p>
        )}

        {result.cards.length > 0 && (
          <ul className={`flex flex-col gap-3 ${busy ? 'opacity-60' : ''}`}>
            {result.cards.map((card) => (
              <li key={card.classId} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{card.className}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    기록 {card.recordedStudents}/{card.activeStudents}명
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  <CountsLine counts={card.counts} />
                </p>

                {card.absentNames.length > 0 && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">결석 {card.absentNames.join(', ')}</p>
                )}
                {card.lateNames.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">지각 {card.lateNames.join(', ')}</p>
                )}

                {card.comments.length > 0 && (
                  <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <p className="font-medium text-zinc-400">코멘트</p>
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {card.comments.map((c, i) => (
                        <li key={i}>
                          · {c.date !== weekStart ? `${formatDateDotted(c.date)} ` : ''}
                          {c.studentName} ({c.status}) {c.comment}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-2 border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-400">
                    총평{card.review.lastModifiedByName ? ` · ${card.review.lastModifiedByName} 수정` : ''}
                  </p>
                  {card.review.body ? (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{card.review.body}</p>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-400">총평이 아직 없습니다.</p>
                  )}
                </div>

                {card.review.replies.length > 0 && (
                  <div className="mt-2 border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-400">목사님 답글</p>
                    <ul className="mt-1 flex flex-col gap-1.5">
                      {card.review.replies.map((r) => (
                        <li key={r.id} className="text-sm">
                          <p className="whitespace-pre-wrap break-words">{r.body}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                            {r.authorName} · {formatDateTimeLabel(r.createdAt)}
                            {r.mine && (
                              <button
                                type="button"
                                onClick={() => handleReplyDelete(r.id)}
                                disabled={deletingReplyIds.has(r.id)}
                                className="text-zinc-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-red-400"
                              >
                                {deletingReplyIds.has(r.id) ? '삭제 중…' : '삭제'}
                              </button>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isPastor && card.review.body && (
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-800">
                    <textarea
                      value={replyDrafts[card.review.reviewId ?? ''] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((current) => ({ ...current, [card.review.reviewId as string]: e.target.value }))
                      }
                      placeholder="답글을 입력하세요"
                      maxLength={2000}
                      rows={2}
                      className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleReplySubmit(card.review.reviewId as string)}
                      disabled={
                        submittingReviewIds.has(card.review.reviewId ?? '') ||
                        (replyDrafts[card.review.reviewId ?? ''] ?? '').trim() === ''
                      }
                      className="self-end rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white/95 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-800 dark:text-sky-50 dark:hover:bg-sky-700"
                    >
                      등록
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
