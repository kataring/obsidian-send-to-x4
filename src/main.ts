/**
 * Send to X4 - Obsidian Plugin
 * Convert Obsidian notes to EPUB and send to Xtenik X4 e-ink reader
 */

import { App, Plugin, TFile, TFolder, TAbstractFile, Notice, MarkdownView } from 'obsidian';
import { SendToX4Settings, DEFAULT_SETTINGS, QueueItem } from './types';
import { SendToX4SettingTab } from './settings';
import { QueueManager } from './queue/queue-manager';

export default class SendToX4Plugin extends Plugin {
    settings: SendToX4Settings = DEFAULT_SETTINGS;
    queueManager: QueueManager = null!;
    private statusBarItem: HTMLElement | null = null;
    private connectionCheckInterval: number | null = null;
    private isUploading = false;

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

        // Add status bar item
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass('mod-clickable');
        this.statusBarItem.addEventListener('click', () => {
            this.uploadQueue();
        });
        this.updateStatusBar();

        // Setup watch folder
        this.setupWatchFolder();

        // Start connection check interval (every 30 seconds)
        this.startConnectionCheck();

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

        // Add file menu item
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
                }
            })
        );

        console.log('Send to X4 plugin loaded');
    }

    onunload() {
        if (this.connectionCheckInterval) {
            window.clearInterval(this.connectionCheckInterval);
        }
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
     * Add a specific file to the queue (used by watch folder)
     */
    private addFileToQueue(file: TFile, silent = false) {
        const item = this.queueManager.addToQueue(file);
        this.saveSettings();
        this.updateStatusBar();

        if (!silent) {
            const pendingCount = this.queueManager.getQueue().filter(i => i.status === 'pending').length;
            new Notice(`Added "${file.basename}" to queue (${pendingCount} pending)`);
        }
    }

    /**
     * Upload all pending items in the queue
     */
    private async uploadQueue() {
        const queue = this.queueManager.getQueue();
        const pendingItems = queue.filter(i => i.status === 'pending');
        const pendingCount = pendingItems.length;

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

            // Move completed files to Sent folder if watch folder is enabled
            if (this.settings.watchFolderEnabled) {
                await this.moveCompletedToSent();
            }

            await this.saveSettings();
            this.updateStatusBar();

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

    /**
     * Update status bar with queue count
     */
    private updateStatusBar() {
        if (!this.statusBarItem) return;

        const queue = this.queueManager.getQueue();
        const pendingCount = queue.filter(i => i.status === 'pending').length;

        if (pendingCount > 0) {
            this.statusBarItem.setText(`X4: ${pendingCount} pending`);
            this.statusBarItem.show();
        } else {
            this.statusBarItem.setText('X4: Queue empty');
            this.statusBarItem.hide();
        }
    }

    /**
     * Setup watch folder event listeners
     */
    setupWatchFolder() {
        if (!this.settings.watchFolderEnabled || !this.settings.watchFolder) {
            return;
        }

        // Watch for file creation in the watch folder
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                this.handleWatchFolderFile(file);
            })
        );

        // Watch for file rename/move into the watch folder
        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                this.handleWatchFolderFile(file);
            })
        );

        // Scan existing files in watch folder on startup
        this.scanWatchFolder();
    }

    /**
     * Handle a file that may be in the watch folder
     */
    private async handleWatchFolderFile(file: TAbstractFile) {
        if (!(file instanceof TFile)) return;
        if (file.extension !== 'md') return;

        const watchFolder = this.settings.watchFolder;
        const sentFolder = `${watchFolder}/Sent`;

        // Check if file is in watch folder but not in Sent subfolder
        if (file.path.startsWith(watchFolder + '/') && !file.path.startsWith(sentFolder + '/')) {
            // Check if already in queue
            const existingQueue = this.queueManager.getQueue();
            if (!existingQueue.some(item => item.filePath === file.path)) {
                this.addFileToQueue(file, false);
                // Try auto-upload
                this.tryAutoUpload();
            }
        }
    }

    /**
     * Scan watch folder for existing files on startup
     */
    private async scanWatchFolder() {
        if (!this.settings.watchFolderEnabled || !this.settings.watchFolder) return;

        const watchFolder = this.app.vault.getAbstractFileByPath(this.settings.watchFolder);
        if (!(watchFolder instanceof TFolder)) return;

        const sentFolder = `${this.settings.watchFolder}/Sent`;

        for (const child of watchFolder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                // Check if already in queue
                const existingQueue = this.queueManager.getQueue();
                if (!existingQueue.some(item => item.filePath === child.path)) {
                    this.addFileToQueue(child, true);
                }
            }
        }

        // Update status bar after scanning
        this.updateStatusBar();
        await this.saveSettings();
    }

    /**
     * Move completed files to Sent subfolder
     */
    private async moveCompletedToSent() {
        const queue = this.queueManager.getQueue();
        const completedItems = queue.filter(i => i.status === 'done');
        const watchFolder = this.settings.watchFolder;
        const sentFolder = `${watchFolder}/Sent`;

        for (const item of completedItems) {
            // Only move files that are in the watch folder
            if (!item.filePath.startsWith(watchFolder + '/')) continue;
            if (item.filePath.startsWith(sentFolder + '/')) continue;

            const file = this.app.vault.getAbstractFileByPath(item.filePath);
            if (!(file instanceof TFile)) continue;

            try {
                // Ensure Sent folder exists
                const sentFolderObj = this.app.vault.getAbstractFileByPath(sentFolder);
                if (!sentFolderObj) {
                    await this.app.vault.createFolder(sentFolder);
                }

                // Move file to Sent folder
                const newPath = `${sentFolder}/${file.name}`;
                await this.app.fileManager.renameFile(file, newPath);

                // Update queue item path
                item.filePath = newPath;
            } catch (error) {
                console.error(`[Send to X4] Failed to move file to Sent folder:`, error);
            }
        }
    }

    /**
     * Start periodic connection check
     */
    private startConnectionCheck() {
        // Check every 30 seconds
        this.connectionCheckInterval = window.setInterval(() => {
            this.tryAutoUpload();
        }, 30000);

        // Also check on startup after a short delay
        window.setTimeout(() => {
            this.tryAutoUpload();
        }, 5000);
    }

    /**
     * Try to auto-upload if connected and has pending items
     */
    private async tryAutoUpload() {
        // Skip if already uploading
        if (this.isUploading) return;

        // Skip if no pending items
        const queue = this.queueManager.getQueue();
        const pendingCount = queue.filter(i => i.status === 'pending').length;
        if (pendingCount === 0) return;

        // Check connection
        const connected = await this.queueManager.isDeviceConnected(this.settings);
        if (!connected) {
            console.log('[Send to X4] Device not connected, skipping auto-upload');
            return;
        }

        console.log('[Send to X4] Device connected, starting auto-upload');
        await this.autoUploadQueue();
    }

    /**
     * Auto-upload queue (silent version)
     */
    private async autoUploadQueue() {
        const queue = this.queueManager.getQueue();
        const pendingCount = queue.filter(i => i.status === 'pending').length;

        if (pendingCount === 0) return;

        this.isUploading = true;
        const notice = new Notice(`Auto-uploading ${pendingCount} items to X4...`, 0);

        try {
            const result = await this.queueManager.uploadQueue(
                this.settings,
                (current, total) => {
                    notice.setMessage(`Auto-uploading ${current}/${total}...`);
                }
            );

            notice.hide();

            // Move completed files to Sent folder
            if (this.settings.watchFolderEnabled) {
                await this.moveCompletedToSent();
            }

            await this.saveSettings();
            this.updateStatusBar();

            new Notice(`Auto-upload complete: ${result.success} succeeded, ${result.failed} failed`);
        } catch (error) {
            notice.hide();
            console.error('[Send to X4] Auto-upload error:', error);
        } finally {
            this.isUploading = false;
        }
    }
}
