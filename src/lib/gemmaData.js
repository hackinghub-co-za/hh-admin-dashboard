// Client-side interface to Gemma, the member-facing AI assistant. Only called for
// real (non-mock) sessions - Mock Member has no Supabase session, so GemmaWidget
// shows a canned local demo instead (see GemmaWidget.jsx).

import { supabase } from './supabase';

/** Fetch this member's own conversation history, oldest first. RLS-protected -
 * a member can only ever read their own rows. */
export async function fetchGemmaHistory(email) {
  const { data, error } = await supabase
    .from('gemma_messages')
    .select('role, content, created_at')
    .eq('email', email.toLowerCase())
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Sends a message to the gemma-chat Edge Function and returns Gemma's reply.
 * supabase.functions.invoke() automatically attaches the caller's JWT. */
export async function sendGemmaMessage(message) {
  const { data, error } = await supabase.functions.invoke('gemma-chat', {
    body: { message },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.reply;
}
