import { describe, it, expect } from 'vitest';
import {
  matchExamReadinessCert,
  SPECIALTIES,
  ROADMAP_TRACKS,
  SPECIALIZATION_CATALOGS,
  PROJECT_CATALOGS,
  ADVANCED_CATALOGS,
  ROADMAP_ITEM_DESCRIPTIONS,
  ROADMAP_ITEM_INFO,
  CERT_CATALOG_BY_VENDOR,
  CORE_FOUNDATIONS_CATALOG,
  CORE_FOUNDATION_PRICING,
} from './memberOptions';
import { displayTitleFor } from './cloudPlatform';

describe('matchExamReadinessCert', () => {
  it('matches each supported cert from a plain name', () => {
    expect(matchExamReadinessCert('CompTIA CySA+')).toBe('CySA+');
    expect(matchExamReadinessCert('eJPT')).toBe('eJPT');
    expect(matchExamReadinessCert('AZ-900')).toBe('AZ-900');
    expect(matchExamReadinessCert('SC-200')).toBe('SC-200');
    expect(matchExamReadinessCert('SC-900')).toBe('SC-900');
    expect(matchExamReadinessCert('CompTIA Security+')).toBe('Security+');
  });

  it('is case-insensitive and tolerates no-hyphen spelling', () => {
    expect(matchExamReadinessCert('az900')).toBe('AZ-900');
    expect(matchExamReadinessCert('sc200')).toBe('SC-200');
    expect(matchExamReadinessCert('SEC+')).toBe('Security+');
  });

  // The exact regression this function's own comment calls out by name:
  // a Microsoft cert whose real title contains the word "security" must
  // not be swallowed by the permissive Security+ substring match. Checked
  // for every non-Security+ branch, since a future new branch appended
  // after Security+'s check would reintroduce this class of bug.
  it('does not misread a Microsoft cert containing "security" as CompTIA Security+', () => {
    expect(matchExamReadinessCert('Security Operations Analyst (SC-200)')).toBe('SC-200');
    expect(matchExamReadinessCert('Microsoft Security, Compliance, and Identity Fundamentals (SC-900)')).toBe('SC-900');
  });

  it('returns null for an unrecognized cert name', () => {
    expect(matchExamReadinessCert('OSCP')).toBeNull();
    expect(matchExamReadinessCert('')).toBeNull();
    expect(matchExamReadinessCert(null)).toBeNull();
    expect(matchExamReadinessCert(undefined)).toBeNull();
  });
});

// SPECIALTIES (a member's self-described directory badge) and ROADMAP_TRACKS
// (a coach-assigned track) are documented as deliberately sharing one
// vocabulary - memberOptions.js's own header comment says they "used to
// diverge" (Red/Blue Team vs Offensive Security/SOC, DevSecOps missing
// entirely) and that this was a real bug. This test exists so that bug
// class can't come back silently: adding a track without its specialty
// counterpart (or vice versa) fails here instead of surfacing months later
// as "my specialty badge doesn't match my roadmap".
describe('SPECIALTIES / ROADMAP_TRACKS vocabulary', () => {
  const realTracks = ROADMAP_TRACKS.filter((t) => t !== 'Not Assigned');
  const realSpecialties = SPECIALTIES.filter((s) => s !== 'Not Set');

  it('every real roadmap track has a matching specialty', () => {
    for (const track of realTracks) {
      expect(realSpecialties).toContain(track);
    }
  });

  it('every real specialty has a matching roadmap track', () => {
    for (const specialty of realSpecialties) {
      expect(realTracks).toContain(specialty);
    }
  });
});

// The roadmap catalogs are keyed by track name (SPECIALIZATION_CATALOGS.SOC,
// .GRC, etc.) - a typo'd or renamed key here silently orphans that track's
// content (it would just never render for anyone assigned to it), with no
// error anywhere to catch it.
describe('roadmap catalogs are keyed by real ROADMAP_TRACKS entries', () => {
  const realTracks = ROADMAP_TRACKS.filter((t) => t !== 'Not Assigned');

  it('every SPECIALIZATION_CATALOGS key is a real track', () => {
    for (const key of Object.keys(SPECIALIZATION_CATALOGS)) {
      expect(realTracks).toContain(key);
    }
  });

  it('every PROJECT_CATALOGS key is a real track', () => {
    for (const key of Object.keys(PROJECT_CATALOGS)) {
      expect(realTracks).toContain(key);
    }
  });

  it('every ADVANCED_CATALOGS key is a real track', () => {
    for (const key of Object.keys(ADVANCED_CATALOGS)) {
      expect(realTracks).toContain(key);
    }
  });

  it('SOC is no longer a track: it was folded into Cybersecurity Analyst', () => {
    expect(ROADMAP_TRACKS).not.toContain('SOC');
    expect(SPECIALTIES).not.toContain('SOC');
    const analystTitles = SPECIALIZATION_CATALOGS['Cybersecurity Analyst'].items.map((i) => i.title);
    ['CySA+', 'THM SOC Level 1', 'SC-200', 'Blue Team Level 1', 'CISCO Cybersecurity Defense Analyst'].forEach((t) => expect(analystTitles).toContain(t));
    const analystProjects = PROJECT_CATALOGS['Cybersecurity Analyst'].items.map((i) => i.title);
    ['Cloud SIEM Detection Lab', 'Incident Response Write-Up'].forEach((t) => expect(analystProjects).toContain(t));
  });

  it('no item is on both a Specialization list and the same track\'s Advanced list', () => {
    for (const track of Object.keys(ADVANCED_CATALOGS)) {
      const spec = new Set((SPECIALIZATION_CATALOGS[track]?.items || []).map((i) => i.title));
      ADVANCED_CATALOGS[track].items.forEach((i) => expect(spec.has(i.title), `${track}: ${i.title}`).toBe(false));
    }
  });

  it('every item on every roadmap has a description and an info entry', () => {
    const titles = [
      ...Object.values(SPECIALIZATION_CATALOGS).flatMap((c) => c.items),
      ...Object.values(PROJECT_CATALOGS).flatMap((c) => c.items),
      ...Object.values(ADVANCED_CATALOGS).flatMap((c) => c.items),
    ].map((i) => i.title);
    titles.forEach((t) => {
      expect(ROADMAP_ITEM_DESCRIPTIONS[t], `${t} has no description`).toBeTruthy();
      expect(ROADMAP_ITEM_INFO[t], `${t} has no info`).toBeTruthy();
    });
  });
});

// CERT_CATALOG_BY_VENDOR feeds the Cert Calendar / Study Hours vendor-then-
// cert picker - a vendor group with no certs (or a duplicate cert name
// across groups) would silently break that dropdown.
describe('CERT_CATALOG_BY_VENDOR', () => {
  it('every vendor group has a name and at least one real cert', () => {
    for (const group of CERT_CATALOG_BY_VENDOR) {
      expect(typeof group.vendor).toBe('string');
      expect(group.vendor.length).toBeGreaterThan(0);
      expect(Array.isArray(group.certs)).toBe(true);
      expect(group.certs.length).toBeGreaterThan(0);
      for (const cert of group.certs) {
        expect(typeof cert).toBe('string');
        expect(cert.length).toBeGreaterThan(0);
      }
    }
  });

  it('has no duplicate vendor name', () => {
    const vendors = CERT_CATALOG_BY_VENDOR.map((g) => g.vendor);
    expect(new Set(vendors).size).toBe(vendors.length);
  });
});

describe('CORE_FOUNDATION_PRICING', () => {
  it('has a price and a note for every Core Foundations catalog item', () => {
    CORE_FOUNDATIONS_CATALOG.forEach(({ title }) => {
      const entry = CORE_FOUNDATION_PRICING[title];
      expect(entry, `${title} has no pricing`).toBeTruthy();
      expect(entry.price).toBeTruthy();
      expect(entry.note).toBeTruthy();
      expect(typeof entry.free).toBe('boolean');
    });
  });

  it('tags exactly Immersive Labs and the free AWS Skill Builder course as free', () => {
    const free = Object.entries(CORE_FOUNDATION_PRICING).filter(([, v]) => v.free).map(([k]) => k).sort();
    expect(free).toEqual(['AWS Security Fundamentals', 'Immersive Labs']);
  });

  it('only prices real catalog items or their AWS equivalents', () => {
    const titles = new Set(CORE_FOUNDATIONS_CATALOG.map((c) => displayTitleFor(c.title, 'Azure')));
    CORE_FOUNDATIONS_CATALOG.forEach((c) => titles.add(displayTitleFor(c.title, 'AWS')));
    Object.keys(CORE_FOUNDATION_PRICING).forEach((k) => expect(titles.has(k)).toBe(true));
  });
});
