import { useState, useEffect } from 'react';
import { UserSearch, CheckCircle2, Trash2, Save } from 'lucide-react';
import { fetchMyTalentProfile, saveMyTalentProfile, deleteMyTalentProfile } from '../lib/talentData';
import { parseSkills } from '../lib/talentHelpers';
import { friendlyMemberErrorMessage } from '../lib/errorMessages';
import { formatDate } from '../lib/dateFormat';

// Talent Pool opt-in for members (supabase/107_talent_pool.sql). A member who
// ticks the consent box gets an anonymous profile (a display ID, their skills,
// years, city and availability) that the founder can put in front of recruiters.
// Their name and contact details are shared only if they say yes to a specific
// introduction. They can change or delete the profile here at any time.

const CONSENT_TEXT = 'I agree that Hacking Hub may share my skills, experience and city with recruiters it works with, as an anonymous profile. My name and contact details are shared only if I say yes to a specific introduction. I can change or delete my profile at any time.';

const EMPTY = { headline: '', summary: '', city: '', workMode: '', availableFrom: '', openToContract: false, skillsText: '', consent: false };

export default function TalentOptIn({ isMockSession }) {
  const [loading, setLoading] = useState(!isMockSession);
  const [profile, setProfile] = useState(null);
  const [defaults, setDefaults] = useState({ summary: '', city: '', years: null, jobTitle: '', verifiedSkills: [] });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const fillFrom = (p, d) => setForm(p
    ? { headline: p.headline, summary: p.summary, city: p.city, workMode: p.workMode, availableFrom: p.availableFrom || '', openToContract: p.openToContract, skillsText: p.selfSkills.join(', '), consent: true }
    : { ...EMPTY, headline: d.jobTitle || '', summary: d.summary || '', city: d.city || '' });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchMyTalentProfile()
      .then(({ profile: p, defaults: d }) => {
        if (cancelled) return;
        setProfile(p);
        setDefaults(d);
        fillFrom(p, d);
      })
      .catch((err) => !cancelled && setError(friendlyMemberErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const set = (key, value) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })); };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.consent) { setError('Tick the box to agree before you join the talent pool.'); return; }
    if (form.headline.trim().length < 3) { setError('Add a short headline, such as "SOC analyst, 3 years".'); return; }
    setSaving(true);
    try {
      const selfSkills = parseSkills(form.skillsText);
      if (isMockSession) {
        setProfile({ displayId: 'T-0100', headline: form.headline.trim(), summary: form.summary, city: form.city, workMode: form.workMode, availableFrom: form.availableFrom, openToContract: form.openToContract, selfSkills, verifiedSkills: [], consentAt: new Date().toISOString(), lastConfirmedAt: new Date().toISOString(), visible: true });
      } else {
        await saveMyTalentProfile({ ...form, headline: form.headline.trim(), selfSkills });
        const fresh = await fetchMyTalentProfile();
        setProfile(fresh.profile);
        setDefaults(fresh.defaults);
      }
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLeave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (!isMockSession) await deleteMyTalentProfile();
      setProfile(null);
      fillFrom(null, defaults);
      setEditing(false);
      setSaved(false);
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const verified = (profile?.verifiedSkills?.length ? profile.verifiedSkills : defaults.verifiedSkills) || [];
  const showForm = editing || !profile;
  const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' };

  if (loading) return null;

  return (
    <div className="glass-card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <UserSearch size={18} color="var(--accent-cyan)" /> Talent Pool
            {profile && <span className={`badge ${profile.visible ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>{profile.visible ? 'You are in the pool' : 'Hidden'}</span>}
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
            Opt in and Hacking Hub can put your skills in front of recruiters. They see an anonymous profile first. Your name and contact details are shared only if you say yes to a specific introduction.
          </p>
        </div>
        {profile && !editing && (
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => { fillFrom(profile, defaults); setEditing(true); }}>Edit profile</button>
        )}
      </div>

      {profile && !editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>{profile.displayId}</span>
            <strong>{profile.headline}</strong>
            {profile.city && <span style={{ color: 'var(--text-secondary)' }}>{profile.city}</span>}
          </div>
          {profile.summary && <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{profile.summary}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {verified.map((s) => <span key={s.tag} className="badge badge-success" style={{ fontSize: '0.7rem' }} title="Verified by Hacking Hub">✓ {s.tag}</span>)}
            {profile.selfSkills.map((s) => <span key={s} className="badge" style={{ fontSize: '0.7rem' }} title="Added by you">{s}</span>)}
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Last confirmed {formatDate(profile.lastConfirmedAt)}. Profiles hide themselves after 12 months, so open Edit profile and save to keep yours showing.
          </p>
          {saved && <p style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Saved.</p>}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {verified.length > 0 && (
            <div>
              <span style={labelStyle}>Verified by Hacking Hub (added automatically)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {verified.map((s) => <span key={s.tag} className="badge badge-success" style={{ fontSize: '0.7rem' }}>✓ {s.tag}</span>)}
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>These come from exams you passed, roadmap items you finished and labs we approved, and they update on their own.</p>
            </div>
          )}
          <div>
            <label htmlFor="talent-headline" style={labelStyle}>Headline</label>
            <input id="talent-headline" className="form-input" maxLength={120} placeholder="SOC analyst, 3 years" value={form.headline} onChange={(e) => set('headline', e.target.value)} />
          </div>
          <div>
            <label htmlFor="talent-summary" style={labelStyle}>Summary ({form.summary.length}/800)</label>
            <textarea id="talent-summary" className="form-input" rows={4} maxLength={800} placeholder="What you have done and what you are looking for. Leave out your name and employer." value={form.summary} onChange={(e) => set('summary', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label htmlFor="talent-city" style={labelStyle}>City</label>
              <input id="talent-city" className="form-input" maxLength={60} value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div>
              <label htmlFor="talent-mode" style={labelStyle}>Where you can work</label>
              <select id="talent-mode" className="form-input" value={form.workMode} onChange={(e) => set('workMode', e.target.value)}>
                <option value="">Not stated</option>
                <option value="Office">Office</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
                <option value="Any">Any</option>
              </select>
            </div>
            <div>
              <label htmlFor="talent-available" style={labelStyle}>Available from</label>
              <input id="talent-available" type="date" className="form-input" value={form.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} />
            </div>
          </div>
          <label htmlFor="talent-contract" style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem' }}>
            <input id="talent-contract" type="checkbox" checked={form.openToContract} onChange={(e) => set('openToContract', e.target.checked)} /> I am open to contract work
          </label>
          <div>
            <label htmlFor="talent-skills" style={labelStyle}>Other skills and tools (separate with commas)</label>
            <textarea id="talent-skills" className="form-input" rows={2} placeholder="Splunk, Python, Sigma rules, Burp Suite" value={form.skillsText} onChange={(e) => set('skillsText', e.target.value)} style={{ resize: 'vertical' }} />
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>Recruiters see these marked as self-reported, next to the skills we verified.</p>
          </div>
          <label htmlFor="talent-consent" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.84rem', lineHeight: 1.5, padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
            <input id="talent-consent" type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} style={{ marginTop: '3px' }} />
            <span>{CONSENT_TEXT}</span>
          </label>
          {error && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</span>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: '0.82rem' }}>
              <Save size={14} /> {saving ? 'Saving...' : profile ? 'Save and re-confirm' : 'Join the talent pool'}
            </button>
            {profile && <button type="button" className="btn btn-secondary" disabled={saving} style={{ fontSize: '0.82rem' }} onClick={() => { setEditing(false); setError(null); }}>Cancel</button>}
          </div>
        </form>
      )}

      {profile && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          <button type="button" onClick={handleLeave} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 0 }}>
            <Trash2 size={13} /> Leave the talent pool and delete my profile
          </button>
        </div>
      )}
      {!showForm && error && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
