/**
 * File Preview Modal - Preview files from X4 device
 */

import { Modal, App, Notice } from 'obsidian';
import { Uploader } from '../upload/uploader-interface';

export class FilePreviewModal extends Modal {
    private filePath: string;
    private fileName: string;
    private uploader: Uploader;
    private objectUrls: string[] = [];

    constructor(app: App, filePath: string, uploader: Uploader) {
        super(app);
        this.filePath = filePath;
        this.fileName = filePath.split('/').pop() || 'file';
        this.uploader = uploader;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('x4-file-preview-modal');

        // Add styles
        this.addStyles();

        // Header
        const header = contentEl.createDiv({ cls: 'x4-preview-header' });
        header.createEl('h2', { text: this.fileName });

        // Content area
        const content = contentEl.createDiv({ cls: 'x4-preview-content' });

        // Loading indicator
        const loading = content.createDiv({ cls: 'x4-preview-loading' });
        loading.setText('Loading...');

        try {
            const data = await this.uploader.downloadFile(this.filePath);
            loading.remove();

            if (!data) {
                content.createDiv({ cls: 'x4-preview-error', text: 'Failed to load file' });
                return;
            }

            const ext = this.getFileExtension();
            await this.renderPreview(content, data, ext);

        } catch (error) {
            loading.remove();
            console.error('[FilePreview] Error:', error);
            content.createDiv({ cls: 'x4-preview-error', text: 'Error loading file' });
        }
    }

    private getFileExtension(): string {
        return this.fileName.split('.').pop()?.toLowerCase() || '';
    }

    private async renderPreview(container: HTMLElement, data: ArrayBuffer, ext: string) {
        switch (ext) {
            case 'epub':
                await this.renderEpubPreview(container, data);
                break;
            case 'txt':
            case 'md':
            case 'html':
            case 'htm':
            case 'css':
            case 'js':
            case 'json':
            case 'xml':
                this.renderTextPreview(container, data);
                break;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'bmp':
                this.renderImagePreview(container, data, ext);
                break;
            case 'pdf':
                this.renderPdfPreview(container, data);
                break;
            default:
                this.renderBinaryInfo(container, data);
        }
    }

    private async renderEpubPreview(container: HTMLElement, data: ArrayBuffer) {
        try {
            // Dynamic import JSZip
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(data);

            // Find content files
            const contentFiles: string[] = [];
            zip.forEach((path) => {
                if (path.endsWith('.html') || path.endsWith('.xhtml') || path.endsWith('.htm')) {
                    contentFiles.push(path);
                }
            });

            if (contentFiles.length === 0) {
                container.createDiv({ cls: 'x4-preview-error', text: 'No readable content found in EPUB' });
                return;
            }

            // Create tabs for chapters
            const tabsContainer = container.createDiv({ cls: 'x4-preview-tabs' });
            const contentContainer = container.createDiv({ cls: 'x4-preview-epub-content' });

            // Sort content files
            contentFiles.sort();

            // Limit to first 10 files for performance
            const displayFiles = contentFiles.slice(0, 10);

            for (let i = 0; i < displayFiles.length; i++) {
                const file = displayFiles[i];
                const shortName = file.split('/').pop() || file;

                const tab = tabsContainer.createDiv({ cls: 'x4-preview-tab' });
                tab.setText(shortName);
                tab.setAttribute('data-index', String(i));

                if (i === 0) {
                    tab.addClass('active');
                }

                tab.addEventListener('click', async () => {
                    tabsContainer.querySelectorAll('.x4-preview-tab').forEach(t => t.removeClass('active'));
                    tab.addClass('active');
                    await this.loadEpubContent(zip, file, contentContainer);
                });
            }

            if (contentFiles.length > 10) {
                const moreTab = tabsContainer.createDiv({ cls: 'x4-preview-tab x4-preview-tab-more' });
                moreTab.setText(`+${contentFiles.length - 10} more`);
            }

            // Load first content
            if (displayFiles.length > 0) {
                await this.loadEpubContent(zip, displayFiles[0], contentContainer);
            }

        } catch (error) {
            console.error('[FilePreview] EPUB parse error:', error);
            container.createDiv({ cls: 'x4-preview-error', text: 'Failed to parse EPUB file' });
        }
    }

    private async loadEpubContent(zip: any, filePath: string, container: HTMLElement) {
        container.empty();

        try {
            const file = zip.file(filePath);
            if (!file) {
                container.setText('File not found');
                return;
            }

            const content = await file.async('string');

            // Create a sandboxed iframe for rendering HTML
            const iframe = container.createEl('iframe', { cls: 'x4-preview-iframe' });
            iframe.setAttribute('sandbox', 'allow-same-origin');

            // Write content to iframe
            iframe.onload = () => {
                const doc = iframe.contentDocument;
                if (doc) {
                    doc.open();
                    doc.write(`
                        <html>
                        <head>
                            <style>
                                body {
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                    padding: 20px;
                                    line-height: 1.6;
                                    color: var(--text-normal, #333);
                                    max-width: 100%;
                                    overflow-x: hidden;
                                }
                                img { max-width: 100%; height: auto; }
                                pre { overflow-x: auto; }
                            </style>
                        </head>
                        <body>${this.extractBody(content)}</body>
                        </html>
                    `);
                    doc.close();
                }
            };

            // Trigger load
            iframe.src = 'about:blank';

        } catch (error) {
            console.error('[FilePreview] Error loading EPUB content:', error);
            container.setText('Error loading content');
        }
    }

    private extractBody(html: string): string {
        // Extract body content from HTML
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            return bodyMatch[1];
        }
        return html;
    }

    private renderTextPreview(container: HTMLElement, data: ArrayBuffer) {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);

        const pre = container.createEl('pre', { cls: 'x4-preview-text' });
        pre.setText(text);
    }

    private renderImagePreview(container: HTMLElement, data: ArrayBuffer, ext: string) {
        const blob = new Blob([data], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
        const url = URL.createObjectURL(blob);
        this.objectUrls.push(url);

        const img = container.createEl('img', { cls: 'x4-preview-image' });
        img.src = url;
        img.alt = this.fileName;
    }

    private renderPdfPreview(container: HTMLElement, data: ArrayBuffer) {
        const blob = new Blob([data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        this.objectUrls.push(url);

        const embed = container.createEl('embed', { cls: 'x4-preview-pdf' });
        embed.setAttribute('type', 'application/pdf');
        embed.setAttribute('src', url);
    }

    private renderBinaryInfo(container: HTMLElement, data: ArrayBuffer) {
        const info = container.createDiv({ cls: 'x4-preview-binary' });
        info.createEl('p', { text: `File: ${this.fileName}` });
        info.createEl('p', { text: `Size: ${this.formatSize(data.byteLength)}` });
        info.createEl('p', { text: 'Binary file - preview not available' });

        // Add download button
        const downloadBtn = info.createEl('button', { cls: 'x4-preview-download-btn' });
        downloadBtn.setText('Download File');
        downloadBtn.addEventListener('click', () => {
            this.downloadFile(data);
        });
    }

    private downloadFile(data: ArrayBuffer) {
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        new Notice(`Downloaded ${this.fileName}`);
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    private addStyles() {
        const style = document.createElement('style');
        style.id = 'x4-preview-styles';

        // Only add if not already present
        if (document.getElementById('x4-preview-styles')) return;

        style.textContent = `
            .x4-file-preview-modal {
                width: 80vw;
                max-width: 900px;
                height: 80vh;
                max-height: 700px;
            }
            .x4-preview-header {
                padding: 10px 0;
                border-bottom: 1px solid var(--background-modifier-border);
                margin-bottom: 10px;
            }
            .x4-preview-header h2 {
                margin: 0;
                font-size: 18px;
                word-break: break-all;
            }
            .x4-preview-content {
                height: calc(100% - 60px);
                overflow: auto;
            }
            .x4-preview-loading {
                text-align: center;
                padding: 40px;
                color: var(--text-muted);
            }
            .x4-preview-error {
                text-align: center;
                padding: 40px;
                color: var(--text-error);
            }
            .x4-preview-tabs {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                padding: 8px 0;
                border-bottom: 1px solid var(--background-modifier-border);
                margin-bottom: 10px;
            }
            .x4-preview-tab {
                padding: 4px 12px;
                background: var(--background-secondary);
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .x4-preview-tab:hover {
                background: var(--background-modifier-hover);
            }
            .x4-preview-tab.active {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }
            .x4-preview-tab-more {
                background: transparent;
                color: var(--text-muted);
                cursor: default;
            }
            .x4-preview-epub-content {
                height: calc(100% - 50px);
            }
            .x4-preview-iframe {
                width: 100%;
                height: 100%;
                border: none;
                background: var(--background-primary);
            }
            .x4-preview-text {
                white-space: pre-wrap;
                word-wrap: break-word;
                font-family: var(--font-monospace);
                font-size: 13px;
                padding: 10px;
                background: var(--background-secondary);
                border-radius: 4px;
                max-height: 100%;
                overflow: auto;
            }
            .x4-preview-image {
                max-width: 100%;
                max-height: 100%;
                display: block;
                margin: 0 auto;
            }
            .x4-preview-pdf {
                width: 100%;
                height: 100%;
                border: none;
            }
            .x4-preview-binary {
                text-align: center;
                padding: 40px;
            }
            .x4-preview-binary p {
                margin: 8px 0;
            }
            .x4-preview-download-btn {
                margin-top: 20px;
                padding: 8px 16px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .x4-preview-download-btn:hover {
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();

        // Clean up object URLs
        for (const url of this.objectUrls) {
            URL.revokeObjectURL(url);
        }
        this.objectUrls = [];
    }
}
