// Markdown -> sanitised HTML, for the small amount of member-facing content
// that's authored as markdown rather than typed into structured fields -
// today that's only weekly_breakdowns.body_md (068_weekly_breakdowns.sql),
// written by admins and Community Managers.
//
// marked does the parse; DOMPurify strips anything dangerous before it ever
// reaches dangerouslySetInnerHTML. The author is a trusted staff account,
// but "trusted" isn't "un-sanitised" - a compromised CM account shouldn't
// be able to run script in every member's browser.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true, // a single newline becomes <br> - matches how people actually write these
  gfm: true,
});

/** Parse a markdown string into sanitised HTML safe for dangerouslySetInnerHTML.
 *  Returns '' for empty/nullish input. */
export function renderMarkdown(md) {
  if (!md || typeof md !== 'string') return '';
  const rawHtml = marked.parse(md);
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
  });
}
