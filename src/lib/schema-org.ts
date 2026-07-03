export const ORG_NAME = 'MLA Generator';
export const ORG_URL = 'https://mlagenerator.com';
export const ORG_LOGO = 'https://mlagenerator.com/images/logo.svg';
export const DEFAULT_AUTHOR = 'MLA Generator Editorial Team';

// Stable @id anchors. Every page emits its JSON-LD as a single @graph in which
// the Organization and WebSite are described once and everything else
// references them by @id, rather than re-describing the publisher on each node.
export const ORG_ID = `${ORG_URL}/#organization`;
export const WEBSITE_ID = `${ORG_URL}/#website`;
export const SOFTWARE_ID = `${ORG_URL}/#software`;

type JsonLd = Record<string, unknown> & { '@context'?: string; '@type': string };

export function buildOrganization(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: ORG_NAME,
    url: ORG_URL,
    // ImageObject (not a bare URL) is the recommended publisher-logo form for
    // Article rich results, which resolve the logo via this @id reference.
    logo: { '@type': 'ImageObject', url: ORG_LOGO },
  };
}

export function buildWebSite(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: ORG_NAME,
    url: ORG_URL,
    publisher: { '@id': ORG_ID },
  };
}

export function buildSoftwareApplication(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: 'MLA Generator Citation Tool',
    url: ORG_URL,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: { '@id': ORG_ID },
    description:
      'Free citation generator that creates accurate APA, MLA, Chicago, Harvard, Vancouver, IEEE, and AMA references from a URL, DOI, or ISBN.',
  };
}

export interface ArticleInput {
  title: string;
  description: string;
  url: string;
  datePublished: Date;
  dateModified?: Date;
  author: string;
  image: string;
  keywords?: string[];
  section?: string;
}

export function buildArticle(input: ArticleInput): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: input.image,
    datePublished: input.datePublished.toISOString(),
    dateModified: (input.dateModified ?? input.datePublished).toISOString(),
    author: { '@type': 'Organization', name: input.author },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    ...(input.keywords ? { keywords: input.keywords } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbList(items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ItemListEntry {
  name: string;
  url: string;
  description?: string;
}

export function buildItemList(items: ItemListEntry[], name: string, url?: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    ...(url ? { url } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: item.url,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqPage(items: FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildAboutPage(url: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url,
    mainEntity: { '@id': ORG_ID },
  };
}

/**
 * Combine independent JSON-LD nodes into a single connected `@graph` document.
 * Each node's own `@context` is dropped (the graph carries one shared context),
 * so nodes can keep returning a standalone-valid `@context` for direct use/tests
 * while still composing cleanly here.
 */
export function buildGraph(nodes: JsonLd[]): { '@context': string; '@graph': object[] } {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.map((node) => {
      const { ['@context']: _ctx, ...rest } = node;
      return rest;
    }),
  };
}
