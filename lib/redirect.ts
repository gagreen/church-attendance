const DEFAULT_PATH = '/';

// 로그인 후 돌아갈 경로(`next` 파라미터)를 검증한다 — 외부 URL로 보내는 open redirect를 막기 위해
// 같은 사이트 내부의 절대 경로("/...")만 허용하고, 그 외에는 기본 경로로 대체한다.
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_PATH;
  // "//evil.com"(프로토콜 상대 URL)과 "/\evil.com"(브라우저가 "//"로 정규화)을 차단
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_PATH;
  }
  // 제어 문자(개행 등)가 섞인 값은 헤더 주입 소지가 있으므로 거부
  if (/[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_PATH;
  return value;
}
