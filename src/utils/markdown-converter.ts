/**
 * Markdown to HTML converter for Obsidian
 * Uses Obsidian's built-in MarkdownRenderer
 */

import { App, MarkdownRenderer, Component } from 'obsidian';
import { cleanForEpub } from './sanitize';

/**
 * Convert Obsidian Markdown to clean XHTML for EPUB
 * @param app - Obsidian App instance
 * @param markdown - Markdown content
 * @param sourcePath - Path of the source file (for resolving links)
 * @returns Clean XHTML string
 */
export async function convertMarkdownToXhtml(
    app: App,
    markdown: string,
    sourcePath: string
): Promise<string> {
    // Create a temporary container
    const container = document.createElement('div');

    // Create a temporary component for the renderer
    const component = new Component();
    component.load();

    try {
        // Use Obsidian's MarkdownRenderer
        await MarkdownRenderer.render(
            app,
            markdown,
            container,
            sourcePath,
            component
        );

        // Get the rendered HTML
        const html = container.innerHTML;

        // Clean and convert to XHTML
        return cleanForEpub(html);
    } finally {
        // Clean up
        component.unload();
    }
}

/**
 * Extract title from markdown content
 * Looks for YAML frontmatter title or first heading
 * @param markdown - Markdown content
 * @returns Title or null
 */
export function extractTitle(markdown: string): string | null {
    // Try to extract from YAML frontmatter
    const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
        if (titleMatch) {
            return titleMatch[1].trim();
        }
    }

    // Try to extract from first heading
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
        return headingMatch[1].trim();
    }

    return null;
}

/**
 * Extract author from markdown YAML frontmatter
 * @param markdown - Markdown content
 * @returns Author or null
 */
export function extractAuthor(markdown: string): string | null {
    const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const authorMatch = frontmatter.match(/^author:\s*["']?(.+?)["']?\s*$/m);
        if (authorMatch) {
            return authorMatch[1].trim();
        }
    }
    return null;
}

/**
 * Extract date from markdown YAML frontmatter
 * @param markdown - Markdown content
 * @returns Date string or null
 */
export function extractDate(markdown: string): string | null {
    const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const dateMatch = frontmatter.match(/^date:\s*["']?(.+?)["']?\s*$/m);
        if (dateMatch) {
            return dateMatch[1].trim();
        }
    }
    return null;
}

/**
 * Remove YAML frontmatter from markdown
 * @param markdown - Markdown content with possible frontmatter
 * @returns Markdown without frontmatter
 */
export function stripFrontmatter(markdown: string): string {
    return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}
