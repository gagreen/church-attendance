import path from 'node:path';
import { defineConfig } from 'vitest/config';

// tsconfig.json의 "@/*" 경로 별칭을 Vitest(Vite 리졸버)에서도 그대로 쓰기 위한 설정.
// lib/db/*.ts처럼 Supabase 클라이언트를 "@/lib/supabase/server"로 import하는 파일 안의 순수 함수를
// 테스트하려면 이 별칭 해석이 반드시 필요하다.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
