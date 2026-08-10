// Supabase persistence for member reviews/feedback. RLS on the `reviews` table
// already scopes what each caller can see (admins: everything, members: public
// reviews + their own private ones) - this file doesn't need to know who's asking,
// it just reflects whatever Supabase returns.

import { supabase } from './supabase';

/** Fetch every review visible to the current signed-in user, newest first. */
export async function fetchReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    email: row.email,
    memberName: row.member_name,
    rating: row.rating,
    category: row.category,
    title: row.title || '',
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at,
  }));
}

/** Submit a new review under the current signed-in user's own email. */
export async function submitReview({ email, memberName, rating, category, title, body, visibility }) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      email: email.toLowerCase(),
      member_name: memberName,
      rating: rating || null,
      category,
      title: title || null,
      body,
      visibility,
    })
    .select()
    .single();
  if (error) throw error;

  return {
    id: data.id,
    email: data.email,
    memberName: data.member_name,
    rating: data.rating,
    category: data.category,
    title: data.title || '',
    body: data.body,
    visibility: data.visibility,
    createdAt: data.created_at,
  };
}
