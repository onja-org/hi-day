import { createHash } from 'crypto';
import type { Request } from 'express';
import {
  bodyTokenTracker,
  emailTracker,
  routeTokenTracker,
  sessionTracker,
} from '../throttler-trackers.util';

const PROXY_IP = '10.0.0.1';

function makeRequest(parts: Partial<Request>): Request {
  // Every tracker gets an `ip` it must ignore — that is the shared bucket.
  return { ip: PROXY_IP, headers: {}, ...parts } as unknown as Request;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('throttler trackers', () => {
  describe('emailTracker', () => {
    it('keys on the email, normalised so case and padding share one bucket', () => {
      expect(
        emailTracker(makeRequest({ body: { email: '  Ada@Example.COM ' } })),
      ).toBe('ada@example.com');
    });

    it('does not fall back to the proxy IP when no email is present', () => {
      const tracker = emailTracker(makeRequest({ body: {} }));

      expect(tracker).not.toBe(PROXY_IP);
      expect(tracker).toBe(
        emailTracker(makeRequest({ body: { email: '  ' } })),
      );
    });

    it('does not fall back to the proxy IP when there is no body at all', () => {
      expect(emailTracker(makeRequest({}))).not.toBe(PROXY_IP);
    });
  });

  describe('sessionTracker', () => {
    it('keys on a hash of the refresh token, never the token itself', () => {
      const request = makeRequest({
        headers: { cookie: 'access_token=a; refresh_token=secret-token' },
      });

      const tracker = sessionTracker(request);

      expect(tracker).toBe(sha256('secret-token'));
      expect(tracker).not.toContain('secret-token');
    });

    it('gives two sessions two different buckets', () => {
      const one = sessionTracker(
        makeRequest({ headers: { cookie: 'refresh_token=one' } }),
      );
      const two = sessionTracker(
        makeRequest({ headers: { cookie: 'refresh_token=two' } }),
      );

      expect(one).not.toBe(two);
    });

    it('does not fall back to the proxy IP when there is no session cookie', () => {
      expect(sessionTracker(makeRequest({}))).not.toBe(PROXY_IP);
    });
  });

  describe('bodyTokenTracker', () => {
    it('keys on a hash of the token in the body', () => {
      expect(
        bodyTokenTracker(makeRequest({ body: { token: 'reset-token' } })),
      ).toBe(sha256('reset-token'));
    });

    it('does not fall back to the proxy IP when no token is present', () => {
      expect(bodyTokenTracker(makeRequest({ body: {} }))).not.toBe(PROXY_IP);
    });
  });

  describe('routeTokenTracker', () => {
    it('keys on a hash of the token in the URL', () => {
      expect(
        routeTokenTracker(makeRequest({ params: { token: 'invite' } })),
      ).toBe(sha256('invite'));
    });

    it('does not fall back to the proxy IP when the route has no token', () => {
      expect(routeTokenTracker(makeRequest({ params: {} }))).not.toBe(PROXY_IP);
    });
  });
});
