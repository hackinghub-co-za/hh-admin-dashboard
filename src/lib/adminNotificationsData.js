// Admin notification bell (supabase/061_admin_notifications.sql) - starts
// with one event, a member completing a roadmap item. Read-only from the
// client's side except marking read - the only insert path is
// toggle_my_roadmap_item()'s SECURITY DEFINER body, never a direct write
// from here. Only called for real (non-mock) admin sessions.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    memberEmail: row.member_email,
    memberName: row.member_name || '',
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Most recent notifications, newest first, capped at 50 - a running feed,
 * not a full archive. */
export async function fetchAdminNotifications() {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('id, type, member_email, member_name, message, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Marks one notification read (e.g. on click). */
export async function markNotificationRead(id) {
  const { error } = await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Marks every currently-unread notification read (the bell's "Mark all read"). */
export async function markAllNotificationsRead() {
  const { error } = await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error) throw error;
}
