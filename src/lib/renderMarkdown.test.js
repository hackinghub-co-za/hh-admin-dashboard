import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './renderMarkdown';

// weekly_breakdowns.body_md is admin/Community-Manager-authored, but
// "trusted" isn't "un-sanitised" (see the file's own header comment) - a
// compromised staff account shouldn't be able to run script in every
// member's browser. These tests exist to catch a regression in that
// sanitization, not just the markdown rendering itself.
describe('renderMarkdown', () => {
  it('renders basic markdown to HTML', () => {
    const html = renderMarkdown('## Heading\n\nSome **bold** text.');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('turns a single newline into <br> (breaks: true)', () => {
    const html = renderMarkdown('Line one\nLine two');
    expect(html).toContain('<br');
  });

  it('strips a raw <script> tag entirely', () => {
    const html = renderMarkdown('Hello <script>alert("xss")</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(');
  });

  it('strips an inline event-handler attribute (onerror, onclick, ...)', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toMatch(/onerror/i);
  });

  it('strips a javascript: URI in a markdown link', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))');
    expect(html).not.toMatch(/javascript:/i);
  });

  it('keeps a real https link intact', () => {
    const html = renderMarkdown('[Hacking Hub](https://hackinghub.co.za)');
    expect(html).toContain('href="https://hackinghub.co.za"');
  });

  it('returns an empty string for empty/nullish/non-string input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown(42)).toBe('');
  });
});
