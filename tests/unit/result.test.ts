/**
 * الغرض: اختبارات وحدة Result pattern
 * الحالة: تنفيد فعلي — أساس تقني بحت
 */

import { describe, expect, test } from 'bun:test';
import { Ok, Err, isOk, isErr, unwrap, unwrapOr, map, mapErr } from '@shared/result';

describe('Result', () => {
  test('Ok creates success result', () => {
    const result = Ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    expect(result.value).toBe(42);
  });

  test('Err creates error result', () => {
    const result = Err(new Error('test error'));
    expect(isOk(result)).toBe(false);
    expect(isErr(result)).toBe(true);
    expect(result.error.message).toBe('test error');
  });

  test('unwrap returns value for Ok', () => {
    const result = Ok(42);
    expect(unwrap(result)).toBe(42);
  });

  test('unwrap throws for Err', () => {
    const result = Err(new Error('test'));
    expect(() => unwrap(result)).toThrow();
  });

  test('unwrapOr returns default for Err', () => {
    const result = Err(new Error('test'));
    expect(unwrapOr(result, 0)).toBe(0);
  });

  test('unwrapOr returns value for Ok', () => {
    const result = Ok(42);
    expect(unwrapOr(result, 0)).toBe(42);
  });

  test('map transforms Ok value', () => {
    const result = Ok(21);
    const mapped = map(result, (x) => x * 2);
    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe(42);
    }
  });

  test('mapErr transforms error', () => {
    const result = Err('original');
    const mapped = mapErr(result, (e) => new Error(e));
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBeInstanceOf(Error);
    }
  });
});
