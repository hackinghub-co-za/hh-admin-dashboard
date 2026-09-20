import { describe, it, expect } from 'vitest';
import { friendlyErrorMessage, friendlyMemberErrorMessage } from './errorMessages';

describe('friendlyErrorMessage', () => {
  it('recognizes a stale/expired session and suggests refreshing', () => {
    expect(friendlyErrorMessage({ message: 'permission denied for function get_member_directory' }))
      .toMatch(/session may have expired/i);
    expect(friendlyErrorMessage({ message: 'JWT expired' })).toMatch(/session may have expired/i);
    expect(friendlyErrorMessage({ message: 'invalid JWT' })).toMatch(/session may have expired/i);
    expect(friendlyErrorMessage({ message: 'new row violates row-level security policy' }))
      .toMatch(/session may have expired/i);
  });

  it('recognizes a clock-skew "issued in the future" token error distinctly from a stale session', () => {
    // Deliberately doesn't also contain "invalid jwt" - that phrase alone
    // matches the session-expired branch first (checked earlier), so this
    // exercises the real message shape the clock-skew branch exists for.
    const msg = friendlyErrorMessage({ message: 'token issued in the future' });
    expect(msg).toMatch(/clock/i);
    expect(msg).not.toMatch(/session may have expired/i);
  });

  it('recognizes a network failure', () => {
    expect(friendlyErrorMessage({ message: 'Failed to fetch' })).toMatch(/reach the server/i);
    expect(friendlyErrorMessage(new TypeError('NetworkError when attempting to fetch resource')))
      .toMatch(/reach the server/i);
  });

  it('passes through an already-human message unchanged (our own RAISE EXCEPTION text)', () => {
    expect(friendlyErrorMessage({ message: 'Only siya@hackinghub.co.za can approve events' }))
      .toBe('Only siya@hackinghub.co.za can approve events');
    expect(friendlyErrorMessage({ message: 'You can log between 1 and 5 rooms per day' }))
      .toBe('You can log between 1 and 5 rooms per day');
  });

  it('falls back to the generic message for a plain string or error-shaped falsy input, without throwing', () => {
    // Only an Error-shaped object's .message is ever echoed back verbatim
    // (the final `error?.message ||` line) - a bare string has no .message
    // property of its own, so even a specific-sounding plain string falls
    // through to the generic fallback rather than being passed through.
    expect(friendlyErrorMessage('Something specific went wrong')).toBe('Something went wrong. Please try again.');
    expect(friendlyErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(friendlyErrorMessage({})).toBe('Something went wrong. Please try again.');
    expect(() => friendlyErrorMessage(undefined)).not.toThrow();
  });
});

describe('friendlyMemberErrorMessage', () => {
  it('collapses a raw Postgres/driver error into one generic line instead of leaking internals', () => {
    expect(friendlyMemberErrorMessage({ message: 'duplicate key value violates unique constraint "cert_calendar_pkey"' }))
      .toBe('Oops, something is wrong here. Please try again in a moment.');
    expect(friendlyMemberErrorMessage({ message: 'relation "public.foo" does not exist' }))
      .toBe('Oops, something is wrong here. Please try again in a moment.');
    expect(friendlyMemberErrorMessage({ message: "TypeError: Cannot read properties of undefined" }))
      .toBe('Oops, something is wrong here. Please try again in a moment.');
  });

  it('still surfaces the specific session-expired message rather than collapsing it', () => {
    expect(friendlyMemberErrorMessage({ message: 'JWT expired' })).toMatch(/session may have expired/i);
  });

  it('still passes through a genuine human-written RAISE EXCEPTION message', () => {
    expect(friendlyMemberErrorMessage({ message: 'You can log between 1 and 5 rooms per day' }))
      .toBe('You can log between 1 and 5 rooms per day');
  });
});
