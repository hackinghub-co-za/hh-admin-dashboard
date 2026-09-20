import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './safeUrl';

// isSafeUrl is the only thing standing between a member-controlled URL
// field (LinkedIn, GitHub, an event link, ...) and stored XSS - if this
// regresses to accept a javascript:/data: URI, every place that renders
// one of those fields as a clickable <a href> becomes exploitable. Kept
// deliberately exhaustive on the "reject" side for that reason.
describe('isSafeUrl', () => {
  it('accepts real http/https URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com/path?query=1')).toBe(true);
    expect(isSafeUrl('https://www.linkedin.com/in/someone')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isSafeUrl('  https://example.com  ')).toBe(true);
  });

  it('rejects javascript: URIs (the core XSS vector this guards against)', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
  });

  it('rejects other dangerous or non-http(s) schemes', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('mailto:someone@example.com')).toBe(false);
  });

  it('rejects empty, nullish, and non-string input', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(42)).toBe(false);
    expect(isSafeUrl({})).toBe(false);
  });

  it('rejects unparseable strings instead of throwing', () => {
    expect(isSafeUrl('not a url at all')).toBe(false);
    expect(() => isSafeUrl('not a url at all')).not.toThrow();
  });

  it('rejects a protocol-relative or bare-path string with no real scheme', () => {
    expect(isSafeUrl('//example.com')).toBe(false);
    expect(isSafeUrl('example.com')).toBe(false);
  });
});
