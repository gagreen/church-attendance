import { NextResponse } from 'next/server';
import { getAccess } from '@/lib/auth';
import { parseAttendanceFlushBody } from '@/lib/attendanceFlushBody';
import { upsertAttendanceBatch } from '@/lib/db/attendance';
import { upsertTeacherAttendanceBatch } from '@/lib/db/teacherAttendance';

// `navigator.sendBeacon`이 치는 전용 엔드포인트. 탭을 닫거나 다른 곳으로 이동하는 순간에는 Server
// Action(fetch) 응답을 기다릴 수 없어 신뢰할 수 없다 — sendBeacon은 페이지가 사라져도 브라우저가 전송을
// 보장하는 유일한 방법이라 일반 Route Handler로 따로 둔다(docs/screens/attendance-input.md).
// 응답은 어차피 아무도 읽지 않으므로(beacon은 fire-and-forget) 실패해도 조용히 로그만 남긴다.
// requireTeacher()는 미인증 시 redirect()를 던져 페이지 전용이라 여기서는 getAccess()로 직접 판단한다.
export async function POST(request: Request) {
  const access = await getAccess();
  if (access.status !== 'ok') return NextResponse.json({ ok: false }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const body = parseAttendanceFlushBody(json);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    if (body.kind === 'student') {
      await upsertAttendanceBatch({ date: body.date, entries: body.entries, teacherId: access.teacher.id });
    } else {
      await upsertTeacherAttendanceBatch({
        date: body.date,
        entries: body.entries,
        recordedBy: access.teacher.id,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('beacon 출석 일괄 저장 실패:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
