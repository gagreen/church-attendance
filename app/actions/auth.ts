'use server';

import { redirect } from 'next/navigation';
import { signOutCurrentUser, startGoogleSignIn } from '@/lib/auth';
import { safeNextPath } from '@/lib/redirect';

export type SignInState = { error?: string };

export async function signInWithGoogle(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  let result: Awaited<ReturnType<typeof startGoogleSignIn>>;
  try {
    result = await startGoogleSignIn(safeNextPath(formData.get('next')));
  } catch (e) {
    console.error('Google 로그인 시작 중 예외:', e);
    result = { ok: false };
  }
  if (!result.ok) {
    return { error: '로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }
  // redirect()는 예외로 동작하므로 try/catch 밖에서 호출한다.
  redirect(result.url);
}

export async function signOut(): Promise<void> {
  await signOutCurrentUser();
  redirect('/login');
}
