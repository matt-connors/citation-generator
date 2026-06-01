import { describe, it, expect } from 'vitest';
import { renderFaqAnswerHtml, faqAnswerText } from '../../src/lib/faq';

describe('renderFaqAnswerHtml', () => {
  it('renders inline markdown (bold, code, links) to HTML', () => {
    const html = renderFaqAnswerHtml('A **bold** word, a `code` span, and a [link](/guides/apa).');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<a href="/guides/apa">link</a>');
  });

  it('does not wrap single-paragraph answers in a block element', () => {
    expect(renderFaqAnswerHtml('plain text answer')).toBe('plain text answer');
  });
});

describe('faqAnswerText', () => {
  it('strips inline markdown to clean plain text for structured data', () => {
    expect(
      faqAnswerText('A **bold** word, a `code` span, and a [link](/guides/apa).'),
    ).toBe('A bold word, a code span, and a link.');
  });

  it('leaves plain text untouched', () => {
    expect(faqAnswerText('No markdown here.')).toBe('No markdown here.');
  });
});
