/**
 * Send to X4 - Obsidian Plugin
 * Convert Obsidian notes to EPUB and send to Xtenik X4 e-ink reader
 */

import { App, Plugin, TFile, Notice, MarkdownView } from 'obsidian';
import { SendToX4Settings, DEFAULT_SETTINGS } from './types';
import { SendToX4SettingTab } from './settings';
import { QueueManager } from './queue/queue-manager';

export default class SendToX4Plugin extends Plugin {
    settings: SendToX4Settings = DEFAULT_SETTINGS;
    queueManager: QueueManager = null!;

    async onload() {
        await this.loadSettings();

        // Initialize queue manager
        this.queueManager = new QueueManager(this.app);

        // Load saved queue
        const savedData = await this.loadData();
        if (savedData?.queue) {
            this.queueManager.loadQueue(savedData.queue);
        }

        // Add settings tab
        this.addSettingTab(new SendToX4SettingTab(this.app, this));

        // Command: Send current note to X4
        this.addCommand({
            id: 'send-current-note',
            name: 'Send current note to X4',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.sendCurrentNote();
                    }
                    return true;
                }
                return false;
            }
        });

        // Command: Add current note to queue
        this.addCommand({
            id: 'add-to-queue',
            name: 'Add current note to queue',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.addCurrentNoteToQueue();
                    }
                    return true;
                }
                return false;
            }
        });

        // Command: Upload queue
        this.addCommand({
            id: 'upload-queue',
            name: 'Upload queue to X4',
            callback: () => {
                this.uploadQueue();
            }
        });

        // Command: Download as EPUB
        this.addCommand({
            id: 'download-epub',
            name: 'Download current note as EPUB',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.downloadAsEpub();
                    }
                    return true;
                }
                return false;
            }
        });

        // Add file menu items
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    menu.addItem((item) => {
                        item.setTitle('Send to X4')
                            .setIcon('upload')
                            .onClick(() => {
                                this.sendFile(file);
                            });
                    });

                    menu.addItem((item) => {
                        item.setTitle('Add to X4 Queue')
                            .setIcon('list-plus')
                            .onClick(() => {
                                this.addFileToQueue(file);
                            });
                    });
                }
            })
        );

        console.log('Send to X4 plugin loaded');
    }

    onunload() {
        console.log('Send to X4 plugin unloaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData({
            ...this.settings,
            queue: this.queueManager.exportQueue()
        });
    }

    /**
     * Send the current active note to X4
     */
    private async sendCurrentNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }

        await this.sendFile(activeFile);
    }

    /**
     * Send a specific file to X4
     */
    private async sendFile(file: TFile) {
        const notice = new Notice(`Sending "${file.basename}" to X4...`, 0);

        try {
            const success = await this.queueManager.uploadFile(file, this.settings);

            notice.hide();

            if (success) {
                new Notice(`Successfully sent "${file.basename}" to X4`);
            } else {
                new Notice(`Failed to send "${file.basename}" to X4`);
            }
        } catch (error) {
            notice.hide();
            console.error('[Send to X4] Error:', error);
            new Notice(`Error: ${(error as Error).message}`);
        }
    }

    /**
     * Add current note to queue
     */
    private addCurrentNoteToQueue() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }

        this.addFileToQueue(activeFile);
    }

    /**
     * Add a specific file to the queue
     */
    private addFileToQueue(file: TFile) {
        const item = this.queueManager.addToQueue(file);
        this.saveSettings();
        new Notice(`Added "${file.basename}" to queue`);
    }

    /**
     * Upload all pending items in the queue
     */
    private async uploadQueue() {
        const queue = this.queueManager.getQueue();
        const pendingCount = queue.filter(i => i.status === 'pending').length;

        if (pendingCount === 0) {
            new Notice('Queue is empty');
            return;
        }

        const notice = new Notice(`Uploading ${pendingCount} items...`, 0);

        try {
            const result = await this.queueManager.uploadQueue(
                this.settings,
                (current, total) => {
                    notice.setMessage(`Uploading ${current}/${total}...`);
                }
            );

            notice.hide();
            await this.saveSettings();

            new Notice(`Upload complete: ${result.success} succeeded, ${result.failed} failed`);
        } catch (error) {
            notice.hide();
            console.error('[Send to X4] Queue upload error:', error);
            new Notice(`Queue upload error: ${(error as Error).message}`);
        }
    }

    /**
     * Download current note as EPUB file
     */
    private async downloadAsEpub() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }

        const notice = new Notice(`Generating EPUB...`, 0);

        try {
            const { data, filename } = await this.queueManager.generateEpub(activeFile);

            notice.hide();

            // Create a blob and download
            const blob = new Blob([data], { type: 'application/epub+zip' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            new Notice(`Downloaded "${filename}"`);
        } catch (error) {
            notice.hide();
            console.error('[Send to X4] EPUB generation error:', error);
            new Notice(`Error generating EPUB: ${(error as Error).message}`);
        }
    }
}
