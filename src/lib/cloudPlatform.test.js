import { describe, it, expect } from 'vitest';
import {
  CLOUD_VARIANT_TITLES, displayTitleFor, applyCloudPlatform, switchItemsPlatform, normalizeCloudPlatform, isCloudVariantTitle,
} from './cloudPlatform';
import { AZURE_TO_AWS } from './awsEquivalents';
import {
  CORE_FOUNDATIONS_CATALOG, SPECIALIZATION_CATALOGS, ADVANCED_CATALOGS,
  ROADMAP_ITEM_LINKS, ROADMAP_ITEM_DESCRIPTIONS, ROADMAP_ITEM_INFO, CORE_FOUNDATION_SUBTASKS, CORE_FOUNDATION_PRICING,
} from './memberOptions';

const row = (over) => ({ id: 1, memberEmail: 'a@b.co', phase: 'Specialization', category: 'Cloud Security', title: 'AZ-104', completed: false, platform: 'Azure', ...over });

describe('Azure to AWS table', () => {
  it('has an AWS equivalent for every Microsoft cloud cert used in any roadmap catalog', () => {
    const titles = new Set(CORE_FOUNDATIONS_CATALOG.map((c) => c.title));
    Object.values(SPECIALIZATION_CATALOGS).forEach((c) => c.items.forEach((i) => titles.add(i.title)));
    Object.values(ADVANCED_CATALOGS).forEach((c) => c.items.forEach((i) => titles.add(i.title)));
    const microsoft = [...titles].filter((t) => /^(AZ|SC|AI|DP|PL|MS)-\d{3}$/.test(t));
    microsoft.forEach((t) => expect(AZURE_TO_AWS[t], `${t} has no AWS equivalent`).toBeTruthy());
  });

  it('gives every AWS equivalent a link, tagline and info entry', () => {
    new Set(Object.values(AZURE_TO_AWS)).forEach((t) => {
      expect(ROADMAP_ITEM_LINKS[t], `${t} link`).toBeTruthy();
      expect(ROADMAP_ITEM_DESCRIPTIONS[t], `${t} tagline`).toBeTruthy();
      expect(ROADMAP_ITEM_INFO[t], `${t} info`).toBeTruthy();
    });
  });

  it('gives the three Core Foundations equivalents subtasks and pricing', () => {
    ['AZ-900', 'AI-901', 'SC-900'].forEach((azure) => {
      const aws = AZURE_TO_AWS[azure];
      expect(CORE_FOUNDATION_SUBTASKS[aws]?.length, `${aws} subtasks`).toBeGreaterThan(0);
      expect(CORE_FOUNDATION_PRICING[aws], `${aws} pricing`).toBeTruthy();
    });
  });

  it('keeps the Core Foundations count at seven on AWS (one-to-one)', () => {
    const aws = new Set(CORE_FOUNDATIONS_CATALOG.map((c) => displayTitleFor(c.title, 'AWS')));
    expect(aws.size).toBe(CORE_FOUNDATIONS_CATALOG.length);
  });

  it('matches the list the database trigger uses', () => {
    expect([...CLOUD_VARIANT_TITLES].sort()).toEqual(
      ['AI-103', 'AI-901', 'AZ-104', 'AZ-305', 'AZ-400', 'AZ-700', 'AZ-900', 'SC-100', 'SC-200', 'SC-300', 'SC-500', 'SC-900'],
    );
  });
});

describe('displayTitleFor', () => {
  it('only swaps on AWS, and only titles that have an equivalent', () => {
    expect(displayTitleFor('AZ-900', 'Azure')).toBe('AZ-900');
    expect(displayTitleFor('AZ-900', 'AWS')).toBe('AWS Certified Cloud Practitioner');
    expect(displayTitleFor('CompTIA Security+', 'AWS')).toBe('CompTIA Security+');
    expect(isCloudVariantTitle('CompTIA Security+')).toBe(false);
  });
});

describe('applyCloudPlatform', () => {
  it('shows an AWS-stamped row as its twin and keeps the slot title', () => {
    const [shown] = applyCloudPlatform([row({ platform: 'AWS' })]);
    expect(shown.title).toBe('AWS Certified Solutions Architect – Associate');
    expect(shown.slotTitle).toBe('AZ-104');
  });

  it('leaves Azure-stamped rows alone, so a finished AZ-900 stays AZ-900', () => {
    const [shown] = applyCloudPlatform([row({ title: 'AZ-900', completed: true, platform: 'Azure' })]);
    expect(shown.title).toBe('AZ-900');
  });

  it('shows the AWS Security Specialty once when several Microsoft security certs collapse onto it', () => {
    const shown = applyCloudPlatform([
      row({ id: 1, title: 'SC-200', platform: 'AWS' }),
      row({ id: 2, title: 'SC-500', platform: 'AWS' }),
      row({ id: 3, title: 'SC-100', platform: 'AWS' }),
    ]);
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('AWS Certified Security – Specialty');
  });

  it('prefers a finished row when collapsing', () => {
    const shown = applyCloudPlatform([
      row({ id: 1, title: 'SC-200', platform: 'AWS' }),
      row({ id: 2, title: 'SC-500', platform: 'AWS', completed: true }),
    ]);
    expect(shown).toHaveLength(1);
    expect(shown[0].id).toBe(2);
  });

  it('collapses onto a native AWS Security Specialty row in Advanced', () => {
    const shown = applyCloudPlatform([
      row({ id: 1, phase: 'Advanced', category: 'Tier 2 Certifications', title: 'SC-500', platform: 'AWS' }),
      row({ id: 2, phase: 'Advanced', category: 'Tier 2 Certifications', title: 'AWS Certified Security – Specialty', platform: 'Azure' }),
    ]);
    expect(shown).toHaveLength(1);
  });

  it('never merges rows across different members', () => {
    const shown = applyCloudPlatform([
      row({ id: 1, memberEmail: 'a@b.co', title: 'SC-200', platform: 'AWS' }),
      row({ id: 2, memberEmail: 'c@d.co', title: 'SC-500', platform: 'AWS' }),
    ]);
    expect(shown).toHaveLength(2);
  });
});

describe('switchItemsPlatform', () => {
  it('moves unfinished cloud rows only', () => {
    const next = switchItemsPlatform([
      row({ id: 1, title: 'AZ-900', completed: true }),
      row({ id: 2, title: 'SC-900' }),
      row({ id: 3, title: 'CompTIA Security+' }),
    ], 'AWS');
    expect(next.map((i) => i.platform)).toEqual(['Azure', 'AWS', 'Azure']);
  });

  it('treats anything but AWS as Azure', () => {
    expect(normalizeCloudPlatform('AWS')).toBe('AWS');
    expect(normalizeCloudPlatform('GCP')).toBe('Azure');
    expect(normalizeCloudPlatform(undefined)).toBe('Azure');
  });
});
