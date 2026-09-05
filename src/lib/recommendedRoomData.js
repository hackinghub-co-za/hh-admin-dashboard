// Daily TryHackMe Room recommendation (supabase/064_recommended_rooms.sql)
// - day-of-year rotation through an admin-curated pool, surfaced as a card
// in the Dashboard's Suggested Content feed.

import { supabase } from './supabase';

export async function fetchTodaysRecommendedRoom() {
  const { data, error } = await supabase.rpc('get_todays_recommended_room');
  if (error) throw error;
  const row = (data || [])[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    difficulty: row.difficulty || '',
  };
}

export async function fetchAllRecommendedRooms() {
  const { data, error } = await supabase
    .from('recommended_rooms')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    difficulty: row.difficulty || '',
    createdAt: row.created_at,
  }));
}

export async function addRecommendedRoom(name, url, difficulty, addedBy) {
  const { error } = await supabase
    .from('recommended_rooms')
    .insert({ name, url, difficulty: difficulty || null, added_by: addedBy || null });
  if (error) throw error;
}

export async function deleteRecommendedRoom(id) {
  const { error } = await supabase.from('recommended_rooms').delete().eq('id', id);
  if (error) throw error;
}
