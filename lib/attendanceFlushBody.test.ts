import { describe, expect, it } from 'vitest';
import { parseAttendanceFlushBody } from './attendanceFlushBody';

describe('parseAttendanceFlushBody', () => {
  it('학생 payload를 그대로 파싱한다', () => {
    const body = {
      kind: 'student',
      date: '2026-09-27',
      entries: [{ studentId: 's1', classId: 'c1', status: '출석', comment: null }],
    };
    expect(parseAttendanceFlushBody(body)).toEqual(body);
  });

  it('교사 payload를 그대로 파싱한다', () => {
    const body = {
      kind: 'teacher',
      date: '2026-09-27',
      entries: [{ target: { teacherId: 't1' }, status: '결석', comment: '감기' }],
    };
    expect(parseAttendanceFlushBody(body)).toEqual({
      kind: 'teacher',
      date: '2026-09-27',
      entries: [{ target: { teacherId: 't1' }, status: '결석', comment: '감기' }],
    });
  });

  it('가입 전 교사(inviteId) 엔트리를 허용한다', () => {
    const body = {
      kind: 'teacher',
      date: '2026-09-27',
      entries: [{ target: { inviteId: 'i1' }, status: '출석', comment: null }],
    };
    expect(parseAttendanceFlushBody(body)).toEqual({
      kind: 'teacher',
      date: '2026-09-27',
      entries: [{ target: { inviteId: 'i1' }, status: '출석', comment: null }],
    });
  });

  it('teacherId와 inviteId가 둘 다 있거나 둘 다 없으면 null', () => {
    const both = { kind: 'teacher', date: '2026-09-27', entries: [{ target: { teacherId: 't1', inviteId: 'i1' }, status: '출석', comment: null }] };
    const neither = { kind: 'teacher', date: '2026-09-27', entries: [{ target: {}, status: '출석', comment: null }] };
    expect(parseAttendanceFlushBody(both)).toBeNull();
    expect(parseAttendanceFlushBody(neither)).toBeNull();
  });

  it('entries가 빈 배열이어도 허용한다', () => {
    expect(parseAttendanceFlushBody({ kind: 'student', date: '2026-09-27', entries: [] })).toEqual({
      kind: 'student',
      date: '2026-09-27',
      entries: [],
    });
  });

  it('kind가 없거나 알 수 없으면 null', () => {
    expect(parseAttendanceFlushBody({ date: '2026-09-27', entries: [] })).toBeNull();
    expect(parseAttendanceFlushBody({ kind: 'admin', date: '2026-09-27', entries: [] })).toBeNull();
  });

  it('date가 없거나 빈 문자열이면 null', () => {
    expect(parseAttendanceFlushBody({ kind: 'student', entries: [] })).toBeNull();
    expect(parseAttendanceFlushBody({ kind: 'student', date: '', entries: [] })).toBeNull();
  });

  it('entries가 배열이 아니면 null', () => {
    expect(parseAttendanceFlushBody({ kind: 'student', date: '2026-09-27', entries: 'x' })).toBeNull();
  });

  it('학생 엔트리에 classId가 없으면 null', () => {
    const body = {
      kind: 'student',
      date: '2026-09-27',
      entries: [{ studentId: 's1', status: '출석', comment: null }],
    };
    expect(parseAttendanceFlushBody(body)).toBeNull();
  });

  it('허용되지 않은 status면 null', () => {
    const body = {
      kind: 'teacher',
      date: '2026-09-27',
      entries: [{ target: { teacherId: 't1' }, status: '조퇴', comment: null }],
    };
    expect(parseAttendanceFlushBody(body)).toBeNull();
  });

  it('comment가 undefined(필드 누락)면 null — null 또는 문자열만 허용', () => {
    const body = {
      kind: 'teacher',
      date: '2026-09-27',
      entries: [{ target: { teacherId: 't1' }, status: '출석' }],
    };
    expect(parseAttendanceFlushBody(body)).toBeNull();
  });

  it('body가 null/배열/원시값이면 null', () => {
    expect(parseAttendanceFlushBody(null)).toBeNull();
    expect(parseAttendanceFlushBody([])).toBeNull();
    expect(parseAttendanceFlushBody('x')).toBeNull();
    expect(parseAttendanceFlushBody(undefined)).toBeNull();
  });
});
