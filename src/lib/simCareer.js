import { emptyCareer } from './simEngine';

const keyFor = (email) => `hh_sim_career_v1:${(email || 'guest').toLowerCase()}`;

export function loadCareer(email) {
  try {
    const raw = localStorage.getItem(keyFor(email));
    if (!raw) return emptyCareer();
    const parsed = JSON.parse(raw);
    return parsed && parsed.version === 1 ? parsed : emptyCareer();
  } catch {
    return emptyCareer();
  }
}

export function saveCareer(email, career) {
  try { localStorage.setItem(keyFor(email), JSON.stringify(career)); } catch { /* storage blocked */ }
}

export function clearCareer(email) {
  try { localStorage.removeItem(keyFor(email)); } catch { /* storage blocked */ }
}
