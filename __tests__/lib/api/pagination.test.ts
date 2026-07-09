import { describe, expect, it } from 'vitest';
import { parsePagination } from '@/lib/api/pagination';

const params = (obj: Record<string, string>) => new URLSearchParams(obj);

describe('parsePagination (L-SEC-12)', () => {
  it('defaults when absent', () => {
    expect(parsePagination(params({}))).toEqual({ limit: 50, offset: 0 });
  });

  it('clamps garbage to the default limit instead of NaN', () => {
    expect(parsePagination(params({ limit: 'abc' })).limit).toBe(50);
    expect(parsePagination(params({ offset: 'xyz' })).offset).toBe(0);
  });

  it('caps the limit at the max and floors at 1', () => {
    expect(parsePagination(params({ limit: '100000' })).limit).toBe(500);
    expect(parsePagination(params({ limit: '0' })).limit).toBe(1);
    expect(parsePagination(params({ limit: '-5' })).limit).toBe(1);
  });

  it('clamps negative offsets to 0 and passes valid values through', () => {
    expect(parsePagination(params({ limit: '25', offset: '10' }))).toEqual({ limit: 25, offset: 10 });
    expect(parsePagination(params({ offset: '-3' })).offset).toBe(0);
  });
});
