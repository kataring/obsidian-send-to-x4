/**
 * HTML Sanitization for EPUB content
 */

/**
 * Clean HTML for EPUB inclusion
 * @param html - Raw HTML string
 * @returns Clean XHTML string
 */
export function cleanForEpub(html: string): string {
    // Create a temporary container using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const temp = doc.body.firstElementChild as HTMLElement;

    if (!temp) {
        return basicCleanup(html);
    }

    // Remove dangerous elements
    const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math'];
    dangerousTags.forEach(tag => {
        temp.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Remove embedded tweets and other card components
    temp.querySelectorAll('[data-testid="tweetEmbed"], [data-testid="card.wrapper"]').forEach(el => el.remove());

    // Remove all event handler attributes and dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
        // Remove event handlers and style attributes
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || attr.name === 'style') {
                el.removeAttribute(attr.name);
            }
        });

        // Convert links to text (remove href for e-reader compatibility)
        if (el.tagName === 'A') {
            const text = el.textContent || '';
            el.replaceWith(document.createTextNode(text));
        }
    });

    // Convert to clean XHTML
    return toXhtml(temp.innerHTML);
}

/**
 * Basic cleanup without full DOM parsing
 * @param html - Raw HTML
 * @returns Cleaned HTML
 */
export function basicCleanup(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+on\w+="[^"]*"/gi, match => match.replace(/on\w+="[^"]*"/gi, ''));
}

/**
 * Convert HTML to XHTML (self-closing tags, etc.)
 * @param html - HTML string
 * @returns XHTML string
 */
export function toXhtml(html: string): string {
    // Fix self-closing tags for XHTML
    const selfClosing = ['br', 'hr', 'img', 'meta', 'link', 'area', 'base', 'col', 'command', 'embed', 'input', 'keygen', 'param', 'source', 'track', 'wbr'];

    let xhtml = html;

    selfClosing.forEach(tag => {
        // Match tags that aren't self-closed and close them
        const regex = new RegExp(`<${tag}([^>]*?)(?<!/)>`, 'gi');
        xhtml = xhtml.replace(regex, `<${tag}$1 />`);
    });

    // Encode special characters that might break XML
    xhtml = xhtml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, '&amp;');

    return xhtml;
}

/**
 * Sanitize text for use in filenames
 * @param text - Input text
 * @param maxLength - Maximum length
 * @returns Sanitized filename
 */
export function sanitizeFilename(text: string, maxLength: number = 80): string {
    if (!text) return 'untitled';
    return text
        .replace(/[\/\\:*?"<>|]/g, '')           // Remove illegal filename chars
        .replace(/\s+/g, ' ')                     // Normalize whitespace
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // Remove emojis
        .trim()
        .substring(0, maxLength) || 'untitled';
}

/**
 * Escape for XML/XHTML attributes and text
 * @param text - Input text
 * @returns Escaped text
 */
export function escapeXml(text: string): string {
    if (!text) return '';
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}
