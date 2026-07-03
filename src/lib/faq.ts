import { marked } from 'marked';

// Guide FAQ answers (in each guide's frontmatter) are authored with inline
// markdown — **bold**, `code`, *italic*, and [links](/guides/.../). They are
// shown via GuideFaq and also fed into FAQPage structured data.

/**
 * Render an answer's inline markdown to HTML for the visible <details> answer.
 * (Answers are author-controlled frontmatter, so the HTML is trusted.)
 */
export function renderFaqAnswerHtml(answer: string): string {
    return marked.parseInline(answer) as string;
}

/**
 * Plain-text form for FAQPage structured data. Google's FAQ rich result only
 * supports a limited set of HTML tags (no <code>), so strip the inline markdown
 * markers to clean text rather than emit tags it would discard.
 */
export function faqAnswerText(answer: string): string {
    return answer
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) -> text
        .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold
        .replace(/\*([^*]+)\*/g, '$1') // *italic* -> italic
        .replace(/`([^`]+)`/g, '$1'); // `code` -> code
}
