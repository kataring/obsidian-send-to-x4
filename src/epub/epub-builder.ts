/**
 * EPUB Builder
 * Generates EPUB files from article/note data using JSZip
 */

import JSZip from 'jszip';
import { ArticleData, EpubMetadata } from '../types';
import { EpubTemplates } from './epub-templates';
import { sanitizeFilename } from '../utils/sanitize';

export class EpubBuilder {
    /**
     * Generate EPUB ArrayBuffer from article data
     * @param article - Article data with title, author, date, body, url
     * @returns EPUB as ArrayBuffer (for Obsidian requestUrl)
     */
    async build(article: ArticleData): Promise<ArrayBuffer> {
        const zip = new JSZip();
        const uuid = this.generateUuid();

        const metadata: EpubMetadata = {
            title: article.title,
            author: article.author,
            date: article.date,
            uuid: uuid
        };

        // Add mimetype file (must be first and uncompressed)
        zip.file('mimetype', EpubTemplates.mimetype, { compression: 'STORE' });

        // Add container.xml in META-INF
        zip.file('META-INF/container.xml', EpubTemplates.containerXml);

        // Add content.opf
        zip.file('OEBPS/content.opf', EpubTemplates.contentOpf(metadata));

        // Add toc.ncx
        zip.file('OEBPS/toc.ncx', EpubTemplates.tocNcx(metadata));

        // Add content.xhtml
        zip.file('OEBPS/content.xhtml', EpubTemplates.contentXhtml(article));

        // Generate the EPUB as ArrayBuffer
        const epubArrayBuffer = await zip.generateAsync({
            type: 'arraybuffer',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        return epubArrayBuffer;
    }

    /**
     * Generate a filename for the EPUB based on format string
     * Format placeholders: {author}, {date}, {title}
     * @param article - Article data with title, author, date
     * @param format - Format string with placeholders (default: '{author} - {date} - {title}')
     * @returns Sanitized filename
     */
    generateFilename(article: ArticleData, format: string = '{author} - {date} - {title}'): string {
        // Prepare components
        let cleanAuthor = '';
        if (article.author) {
            cleanAuthor = article.author.replace(/^@/, '').replace(/[^a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
        }

        const date = article.date || new Date().toISOString().split('T')[0];
        const safeTitle = sanitizeFilename(article.title, 40) || 'untitled';

        // Replace placeholders
        let filename = format
            .replace(/\{author\}/g, cleanAuthor)
            .replace(/\{date\}/g, date)
            .replace(/\{title\}/g, safeTitle);

        // Clean up empty placeholders and extra separators
        filename = filename
            .replace(/\s*-\s*-\s*/g, ' - ')  // Remove double separators
            .replace(/^\s*-\s*/, '')          // Remove leading separator
            .replace(/\s*-\s*$/, '')          // Remove trailing separator
            .trim();

        // Fallback if filename is empty
        if (!filename) {
            filename = safeTitle || date;
        }

        return filename + '.epub';
    }

    /**
     * Generate a UUID v4
     */
    private generateUuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
