// Comments on Recent Wins (community_win_comments, 044_community_content.sql).
// Everything goes through RPCs: the database decides who the author is and
// whether the caller may read, add or delete, so nothing here is trusted.
import { supabase } from './supabase';

export const MAX_COMMENT_LENGTH = 500;

function mapComment(row) {
  return {
    id: row.id,
    winId: row.win_id,
    authorEmail: row.author_email || '',
    authorName: row.author_name || '',
    body: row.body,
    createdAt: row.created_at,
    isMine: !!row.is_mine,
  };
}

/** Comments for these wins, grouped by win id, oldest first within each. */
export async function fetchWinComments(winIds) {
  if (!winIds?.length) return {};
  const { data, error } = await supabase.rpc('get_win_comments', { p_win_ids: winIds });
  if (error) throw error;
  return groupByWin((data || []).map(mapComment));
}

export async function addWinComment(winId, body) {
  const { data, error } = await supabase.rpc('add_win_comment', { p_win_id: winId, p_body: body });
  if (error) throw error;
  return mapComment(Array.isArray(data) ? data[0] : data);
}

export async function deleteWinComment(id) {
  const { error } = await supabase.rpc('delete_win_comment', { p_id: id });
  if (error) throw error;
}

export function groupByWin(comments) {
  return comments.reduce((acc, c) => {
    (acc[c.winId] ||= []).push(c);
    return acc;
  }, {});
}
