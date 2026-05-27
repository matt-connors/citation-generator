import { describe, expect, it } from 'vitest';
import {
  buildOrganization,
  buildWebSite,
  buildSoftwareApplication,
  buildArticle,
  buildBreadcrumbList,
  buildFaqPage,
  buildAboutPage,
  ORG_NAME,
  ORG_URL,
  ORG_LOGO,
} from '../../src/lib/schema-org';

describe('buildOrganization', () => {
  it('returns an Organization with name, url, logo', () => {
    const org = buildOrganization();
    expect(org['@context']).toBe('https://schema.org');
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe(ORG_NAME);
    expect(org.url).toBe(ORG_URL);
    expect(org.logo).toBe(ORG_LOGO);
  });
});

describe('buildWebSite', () => {
  it('includes a SearchAction targeting /guides', () => {
    const site = buildWebSite();
    expect(site['@type']).toBe('WebSite');
    expect(site.potentialAction['@type']).toBe('SearchAction');
    expect(site.potentialAction.target).toContain('{search_term_string}');
  });
});

describe('buildSoftwareApplication', () => {
  it('describes the free citation tool', () => {
    const app = buildSoftwareApplication();
    expect(app['@type']).toBe('SoftwareApplication');
    expect(app.applicationCategory).toBe('EducationalApplication');
    expect(app.operatingSystem).toBe('Web');
    expect(app.offers.price).toBe('0');
  });
});

describe('buildArticle', () => {
  it('builds Article from required fields', () => {
    const a = buildArticle({
      title: 'APA Guide',
      description: 'A guide',
      url: 'https://mlagenerator.com/guides/apa',
      datePublished: new Date('2026-01-01'),
      dateModified: new Date('2026-05-27'),
      author: 'MLA Generator Editorial Team',
      image: 'https://mlagenerator.com/images/banner.png',
      keywords: ['apa', 'citations'],
      section: 'style-guide',
    });
    expect(a['@type']).toBe('Article');
    expect(a.headline).toBe('APA Guide');
    expect(a.datePublished).toBe('2026-01-01T00:00:00.000Z');
    expect(a.dateModified).toBe('2026-05-27T00:00:00.000Z');
    expect(a.author).toEqual({ '@type': 'Organization', name: 'MLA Generator Editorial Team' });
    expect(a.publisher.name).toBe(ORG_NAME);
    expect(a.mainEntityOfPage['@id']).toBe('https://mlagenerator.com/guides/apa');
    expect(a.keywords).toEqual(['apa', 'citations']);
    expect(a.articleSection).toBe('style-guide');
  });

  it('falls back dateModified to datePublished when missing', () => {
    const a = buildArticle({
      title: 't',
      description: 'd',
      url: 'u',
      datePublished: new Date('2026-01-01'),
      author: 'x',
      image: 'i',
    });
    expect(a.dateModified).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('buildBreadcrumbList', () => {
  it('numbers items in order from 1', () => {
    const b = buildBreadcrumbList([
      { name: 'Home', url: 'https://mlagenerator.com/' },
      { name: 'Guides', url: 'https://mlagenerator.com/guides' },
      { name: 'APA', url: 'https://mlagenerator.com/guides/apa' },
    ]);
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement).toHaveLength(3);
    expect(b.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://mlagenerator.com/',
    });
    expect(b.itemListElement[2].position).toBe(3);
  });
});

describe('buildFaqPage', () => {
  it('wraps each q/a as a Question with an Answer', () => {
    const f = buildFaqPage([
      { question: 'Is this free?', answer: 'Yes.' },
      { question: 'Does it support APA?', answer: 'Yes, APA 7.' },
    ]);
    expect(f['@type']).toBe('FAQPage');
    expect(f.mainEntity).toHaveLength(2);
    expect(f.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Is this free?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
    });
  });
});

describe('buildAboutPage', () => {
  it('references the organization', () => {
    const a = buildAboutPage('https://mlagenerator.com/about');
    expect(a['@type']).toBe('AboutPage');
    expect(a.url).toBe('https://mlagenerator.com/about');
    expect(a.mainEntity['@type']).toBe('Organization');
  });
});
