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
     * Generate a filename for the EPUB
     * Format: author - YYYY-MM-DD - title.epub
     * @param article - Article data with title, author, date
     * @returns Sanitized filename
     */
    generateFilename(article: ArticleData): string {
        const parts: string[] = [];

        // Add author if available
        if (article.author) {
            const cleanAuthor = article.author.replace(/^@/, '').replace(/[^a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
            if (cleanAuthor) {
                parts.push(cleanAuthor);
            }
        }

        // Add date (prefer extracted date, fallback to today)
        const date = article.date || new Date().toISOString().split('T')[0];
        parts.push(date);

        // Add sanitized title
        const safeTitle = sanitizeFilename(article.title, 40);
        if (safeTitle) {
            parts.push(safeTitle);
        }

        return parts.join(' - ') + '.epub';
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
