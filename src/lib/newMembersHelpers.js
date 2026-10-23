// Pure helpers for the New members list (components/NewMembersOnboarding.jsx).
// `steps` is the object get_new_members_onboarding() returns for a member:
// each completed step key mapped to when it was completed.

/** The steps shown in the list, in the order a member does them. */
export const NEW_MEMBER_STEPS = [
  'watch_video',
  'setup_profile',
  'join_whatsapp',
  'say_hi_lesedi',
  'linkedin_reviewed',
  'intro_approved',
  'intro_posted',
];

/** How many of the seven steps are done. */
export function onboardingProgress(steps) {
  const done = steps || {};
  return NEW_MEMBER_STEPS.filter((key) => !!done[key]).length;
}

/**
 * Who the next move belongs to, so Lesedi can see at a glance who is waiting
 * on her. `who` is 'done', 'lesedi' or 'member'.
 */
export function waitingOn(steps) {
  const s = steps || {};
  if (s.intro_posted) return { who: 'done', label: 'All done' };
  if (!s.say_hi_lesedi) return { who: 'member', label: 'Member: say hi to Lesedi' };
  if (!s.linkedin_reviewed) return { who: 'lesedi', label: 'Lesedi: LinkedIn review' };
  if (!s.intro_approved) return { who: 'lesedi', label: 'Lesedi: approve intro' };
  return { who: 'member', label: 'Member: post the intro' };
}
