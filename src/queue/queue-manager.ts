/**
 * Queue Manager
 * Manages a queue of files to upload to X4
 */

import { App, TFile, Notice } from 'obsidian';
import { QueueItem, ArticleData, SendToX4Settings } from '../types';
import { EpubBuilder } from '../epub/epub-builder';
import { convertMarkdownToXhtml, extractTitle, extractAuthor, extractDate, stripFrontmatter } from '../utils/markdown-converter';
import { Uploader } from '../upload/uploader-interface';
import { X4Uploader } from '../upload/x4-uploader';
import { CrossPointUploader } from '../upload/crosspoint-uploader';

export class QueueManager {
    private app: App;
    private queue: QueueItem[] = [];
    private epubBuilder: EpubBuilder;

    constructor(app: App) {
        this.app = app;
        this.epubBuilder = new EpubBuilder();
    }

    /**
     * Get the current queue
     */
    getQueue(): QueueItem[] {
        return [...this.queue];
    }

    /**
     * Add a file to the queue
     */
    addToQueue(file: TFile): QueueItem {
        // Check if already in queue
        const existing = this.queue.find(item => item.filePath === file.path);
        if (existing) {
            return existing;
        }

        const item: QueueItem = {
            id: this.generateId(),
            title: file.basename,
            filePath: file.path,
            status: 'pending'
        };

        this.queue.push(item);
        return item;
    }

    /**
     * Remove an item from the queue
     */
    removeFromQueue(id: string): boolean {
        const index = this.queue.findIndex(item => item.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Clear completed items from the queue
     */
    clearCompleted(): void {
        this.queue = this.queue.filter(item => item.status !== 'done');
    }

    /**
     * Clear all items from the queue
     */
    clearAll(): void {
        this.queue = [];
    }

    /**
     * Upload a single file to a specific folder on X4
     */
    async uploadFileToFolder(file: TFile, settings: SendToX4Settings, targetFolder: string): Promise<boolean> {
        try {
            console.log('[QueueManager] uploadFileToFolder called for:', file.path, 'to folder:', targetFolder);

            // Read the file content
            const content = await this.app.vault.read(file);
            console.log('[QueueManager] File content length:', content.length);

            // Build article data
            const articleData = await this.buildArticleData(file, content);
            console.log('[QueueManager] Article data built:', articleData.title);

            // Build EPUB
            const epubData = await this.epubBuilder.build(articleData);
            const filename = this.epubBuilder.generateFilename(articleData, settings.filenameFormat);
            console.log('[QueueManager] EPUB built:', filename, 'size:', epubData.byteLength);

            // Get appropriate uploader
            const uploader = this.getUploader(settings);
            console.log('[QueueManager] Using uploader:', settings.useCrosspointFirmware ? 'CrossPoint' : 'X4');

            // Upload
            console.log('[QueueManager] Starting upload...');
            const result = await uploader.uploadEpub(epubData, filename, targetFolder);
            console.log('[QueueManager] Upload result:', result);

            return result.success;
        } catch (error) {
            console.error('[QueueManager] Upload error:', error);
            throw error;
        }
    }

    /**
     * Generate EPUB for download (without uploading)
     */
    async generateEpub(file: TFile, filenameFormat?: string): Promise<{ data: ArrayBuffer; filename: string }> {
        const content = await this.app.vault.read(file);
        const articleData = await this.buildArticleData(file, content);

        const epubData = await this.epubBuilder.build(articleData);
        const filename = this.epubBuilder.generateFilename(articleData, filenameFormat);

        return { data: epubData, filename };
    }

    /**
     * Build article data from a file
     */
    private async buildArticleData(file: TFile, content: string): Promise<ArticleData> {
        // Extract metadata from frontmatter
        const title = extractTitle(content) || file.basename;
        const author = extractAuthor(content) || '';
        const date = extractDate(content) || new Date().toISOString().split('T')[0];

        // Strip frontmatter and convert markdown to XHTML
        const markdownBody = stripFrontmatter(content);
        const body = await convertMarkdownToXhtml(this.app, markdownBody, file.path);

        return {
            title,
            author,
            date,
            body
        };
    }

    /**
     * Check if the device is connected
     */
    async isDeviceConnected(settings: SendToX4Settings): Promise<boolean> {
        const uploader = this.getUploader(settings);
        return uploader.isConnected();
    }

    /**
     * Get the appropriate uploader based on settings
     */
    private getUploader(settings: SendToX4Settings): Uploader {
        if (settings.useCrosspointFirmware) {
            return new CrossPointUploader(settings.crosspointIp);
        } else {
            return new X4Uploader(settings.x4Ip);
        }
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Load queue from storage
     */
    loadQueue(data: QueueItem[]): void {
        if (Array.isArray(data)) {
            // Reset status of uploading items to pending
            this.queue = data.map(item => ({
                ...item,
                status: item.status === 'uploading' ? 'pending' : item.status
            }));
        }
    }

    /**
     * Export queue for storage
     */
    exportQueue(): QueueItem[] {
        return this.queue;
    }
}
