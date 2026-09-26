import { describe, expect, it } from 'vitest';
import { sortStudents } from './students';

describe('sortStudents', () => {
  it('grade 내림차순(고3→중1)으로 정렬한다', () => {
    const result = sortStudents([
      { name: 'A', grade: '중1' },
      { name: 'B', grade: '고3' },
      { name: 'C', grade: '중3' },
    ]);
    expect(result.map((s) => s.grade)).toEqual(['고3', '중3', '중1']);
  });

  it('같은 grade 안에서는 이름 가나다순', () => {
    const result = sortStudents([
      { name: '박지훈', grade: '중1' },
      { name: '김민수', grade: '중1' },
    ]);
    expect(result.map((s) => s.name)).toEqual(['김민수', '박지훈']);
  });

  it('grade가 null인 학생(미지정)은 맨 아래', () => {
    const result = sortStudents([
      { name: '최하은', grade: null },
      { name: '이서연', grade: '고2' },
    ]);
    expect(result.map((s) => s.name)).toEqual(['이서연', '최하은']);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const input = [
      { name: 'B', grade: '중1' as const },
      { name: 'A', grade: '고3' as const },
    ];
    const copy = [...input];
    sortStudents(input);
    expect(input).toEqual(copy);
  });
});
