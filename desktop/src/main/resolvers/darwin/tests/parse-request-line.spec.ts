import { describe, expect, it } from 'vitest';
import { parseRequestLine } from '../index';

describe('parseRequestLine', () => {
  it('accepts a valid ping request', () => {
    expect(parseRequestLine('{"id":1,"op":"ping"}')).toEqual({ id: 1, op: 'ping' });
  });

  it('accepts a valid resolve request', () => {
    expect(parseRequestLine('{"id":2,"op":"resolve","pid":100,"hwnd":0}')).toEqual({
      id: 2,
      op: 'resolve',
      pid: 100,
      hwnd: 0,
    });
  });

  it('rejects malformed JSON without throwing', () => {
    expect(parseRequestLine('not json at all')).toBeNull();
  });

  // Regression coverage: a bare JSON literal here used to crash the whole
  // side-car process — `parsed as ResolverRequest` was cast without first
  // checking `parsed` was actually an object, so `request.op` on `null`
  // threw synchronously inside the stdin data handler.
  it('rejects a bare "null" literal without throwing', () => {
    expect(parseRequestLine('null')).toBeNull();
  });

  it('rejects a bare number without throwing', () => {
    expect(parseRequestLine('42')).toBeNull();
  });

  it('rejects a bare string without throwing', () => {
    expect(parseRequestLine('"hello"')).toBeNull();
  });

  it('rejects an array without throwing', () => {
    expect(parseRequestLine('[1,2,3]')).toBeNull();
  });

  it('rejects an object with no op', () => {
    expect(parseRequestLine('{"id":1}')).toBeNull();
  });

  it('rejects an object with an unrecognized op', () => {
    expect(parseRequestLine('{"id":1,"op":"launch-nukes"}')).toBeNull();
  });

  it('rejects a resolve request missing pid/hwnd', () => {
    expect(parseRequestLine('{"id":1,"op":"resolve"}')).toBeNull();
  });

  it('rejects a request with a non-numeric id', () => {
    expect(parseRequestLine('{"id":"one","op":"ping"}')).toBeNull();
  });
});
