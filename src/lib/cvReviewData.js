// Gemma CV & LinkedIn Review (supabase/055_cv_reviews.sql +
// supabase/functions/gemma-review). Only called for real (non-mock)
// sessions - Mock Member has no Supabase session, so the review UI shows a
// canned local demo instead (see CvReviewModal.jsx).

import { supabase } from './supabase';

/** Submits CV and/or LinkedIn text for review. At least one of the two must
 * be non-empty. Returns the structured review; also persisted server-side
 * (the raw text itself is never stored, only the review output). */
export async function submitForReview(cvText, linkedinText) {
  const { data, error } = await supabase.functions.invoke('gemma-review', {
    body: { cvText, linkedinText },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return {
    overallScore: data.overallScore,
    categories: data.categories || [],
    reviewType: data.reviewType,
  };
}

/** This member's own past reviews, most recent first - RLS scopes this to
 * their own rows. */
export async function fetchMyReviews() {
  const { data, error } = await supabase
    .from('cv_reviews')
    .select('id, review_type, overall_score, categories, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    reviewType: row.review_type,
    overallScore: row.overall_score,
    categories: row.categories || [],
    createdAt: row.created_at,
  }));
}
