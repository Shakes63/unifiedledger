import { describe, it, expect } from 'vitest';
import { splitByRetentionCount } from '@/lib/backups/backup-utils';

describe('lib/backups/backup-utils', () => {
  describe('splitByRetentionCount', () => {
    it('keeps N newest and removes the rest', () => {
      const items = ['a', 'b', 'c', 'd']; // assume newest-first
      const result = splitByRetentionCount(items, 2);

      expect(result.retentionCount).toBe(2);
      expect(result.keep).toEqual(['a', 'b']);
      expect(result.remove).toEqual(['c', 'd']);
    });

    it('treats negative retention as 0', () => {
      const items = ['a', 'b'];
      const result = splitByRetentionCount(items, -5);

      expect(result.retentionCount).toBe(0);
      expect(result.keep).toEqual([]);
      expect(result.remove).toEqual(['a', 'b']);
    });

    it('floors non-integer retention', () => {
      const items = ['a', 'b', 'c'];
      const result = splitByRetentionCount(items, 1.9);

      expect(result.retentionCount).toBe(1);
      expect(result.keep).toEqual(['a']);
      expect(result.remove).toEqual(['b', 'c']);
    });

    it('treats null/undefined/NaN as 0', () => {
      const items = ['a'];
      expect(splitByRetentionCount(items, null).retentionCount).toBe(0);
      expect(splitByRetentionCount(items, undefined).retentionCount).toBe(0);
      expect(splitByRetentionCount(items, Number.NaN).retentionCount).toBe(0);
    });

    it('does not mutate original array', () => {
      const items = ['a', 'b', 'c'];
      const copy = [...items];
      splitByRetentionCount(items, 2);
      expect(items).toEqual(copy);
    });
  });
});
