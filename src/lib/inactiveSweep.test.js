import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/111_inactive_member_removal.sql'), 'utf8');
const fn = readFileSync(resolve(process.cwd(), 'supabase/functions/inactive-members-sweep/index.ts'), 'utf8');

describe('inactive member sweep rules', () => {
  it('warns at 57 days, removes at 60 days and only after a warning at least 3 days old', () => {
    expect(sql).toContain('days_inactive >= 57');
    expect(sql).toContain('days_inactive >= 60');
    expect(sql).toContain("inactivity_warned_at AT TIME ZONE 'Africa/Johannesburg')::date <= v_today - 3");
  });
  it('exempts mentors and only looks at active members', () => {
    expect(sql).toContain("COALESCE(role, 'member') <> 'mentor'");
    expect(sql).toContain("mp.status IN ('Active', 'Active (Permanent)')");
    expect(sql).toContain('AND NOT inactivity_exempt');
  });
  it('spares anyone who has paid in the last 60 days', () => {
    expect(sql).toContain('v_today - last_payment > 60');
  });
  it('removing means status Left, and the helpers are service-role only', () => {
    expect(sql).toContain("status = 'Left'");
    ['inactivity_candidates()', 'mark_inactivity_warned(TEXT[])', 'remove_inactive_members(TEXT[])'].forEach((f) => {
      expect(sql, f).toContain(`REVOKE EXECUTE ON FUNCTION public.${f} FROM PUBLIC, anon, authenticated;`);
    });
  });
  it('the edge function only marks people as warned after the warning email is sent', () => {
    expect(fn.indexOf('await sendEmail(resendKey, mail.subject, mail.html);\n      const { data: marked')).toBeGreaterThan(-1);
    expect(fn).toContain('dryRun');
  });
});
