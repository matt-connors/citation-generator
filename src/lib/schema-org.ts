export const ORG_NAME = 'MLA Generator';
export const ORG_URL = 'https://mlagenerator.com';
export const ORG_LOGO = 'https://mlagenerator.com/images/logo.svg';
export const DEFAULT_AUTHOR = 'MLA Generator Editorial Team';

type JsonLd = Record<string, unknown> & { '@context'?: string; '@type': string };

export function buildOrganization(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: ORG_URL,
    logo: ORG_LOGO,
  };
}

export function buildWebSite(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: ORG_NAME,
    url: ORG_URL,
  };
}

export function buildSoftwareApplication(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MLA Generator Citation Tool',
    url: ORG_URL,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
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
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
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
    mainEntity: buildOrganization(),
  };
}
