/**
 * Send to X4 - Obsidian Plugin
 * Convert Obsidian notes to EPUB and send to Xtenik X4 e-ink reader
 */

import { App, Plugin, TFile, Notice, MarkdownView } from 'obsidian';
import { SendToX4Settings, DEFAULT_SETTINGS, QueueItem } from './types';
import { SendToX4SettingTab } from './settings';
import { QueueManager } from './queue/queue-manager';
import { X4TreeView, X4_TREE_VIEW_TYPE } from './views/x4-tree-view';
import { FilePickerModal } from './views/file-picker-modal';

export default class SendToX4Plugin extends Plugin {
    settings: SendToX4Settings = DEFAULT_SETTINGS;
    queueManager: QueueManager = null!;
    private statusBarItem: HTMLElement | null = null;

    async onload() {
        console.log('[Send to X4] onload started');

        try {
            await this.loadSettings();
            console.log('[Send to X4] Settings loaded');
        } catch (e) {
            console.error('[Send to X4] Failed to load settings:', e);
        }

        // Initialize queue manager
        this.queueManager = new QueueManager(this.app);

        // Load saved queue
        try {
            const savedData = await this.loadData();
            if (savedData?.queue) {
                this.queueManager.loadQueue(savedData.queue);
            }
            console.log('[Send to X4] Queue loaded');
        } catch (e) {
            console.error('[Send to X4] Failed to load queue:', e);
        }

        // Register X4 Tree View
        console.log('[Send to X4] Registering view...');
        this.registerView(
            X4_TREE_VIEW_TYPE,
            (leaf) => {
                console.log('[Send to X4] Creating X4TreeView instance');
                return new X4TreeView(
                    leaf,
                    () => this.settings,
                    () => (targetFolder: string) => this.showFilePicker(targetFolder)
                );
            }
        );
        console.log('[Send to X4] View registered');

        // Add settings tab
        this.addSettingTab(new SendToX4SettingTab(this.app, this));

        // Add status bar item
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass('mod-clickable');
        this.statusBarItem.addEventListener('click', () => {
            this.uploadQueue();
        });
        this.updateStatusBar();

        // Add ribbon icon for X4 file browser
        this.addRibbonIcon('hard-drive', 'X4 Files', () => {
            this.activateTreeView();
        });

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

        // Command: Open X4 file browser
        this.addCommand({
            id: 'open-x4-files',
            name: 'Open X4 file browser',
            callback: () => {
                this.activateTreeView();
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
        // Detach tree view leaves
        this.app.workspace.detachLeavesOfType(X4_TREE_VIEW_TYPE);
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
        console.log('[Send to X4] sendFile called for:', file.path);
        const notice = new Notice(`Sending "${file.basename}" to X4...`, 0);

        try {
            console.log('[Send to X4] Calling queueManager.uploadFile...');
            const success = await this.queueManager.uploadFile(file, this.settings);
            console.log('[Send to X4] uploadFile result:', success);

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
     * Activate the X4 tree view in the right sidebar
     */
    async activateTreeView() {
        const { workspace } = this.app;

        // Check if view is already open
        const existingLeaves = workspace.getLeavesOfType(X4_TREE_VIEW_TYPE);
        if (existingLeaves.length > 0) {
            // Reveal existing view
            workspace.revealLeaf(existingLeaves[0]);
            return;
        }

        // Create new view in right sidebar
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) {
            await rightLeaf.setViewState({
                type: X4_TREE_VIEW_TYPE,
                active: true
            });
            workspace.revealLeaf(rightLeaf);
        }
    }

    /**
     * Show file picker modal to select notes for upload
     */
    private showFilePicker(targetFolder: string) {
        const modal = new FilePickerModal(this.app, targetFolder, async (files) => {
            await this.uploadFilesToFolder(files, targetFolder);
        });
        modal.open();
    }

    /**
     * Upload selected files to the specified folder on X4
     */
    private async uploadFilesToFolder(files: TFile[], targetFolder: string) {
        if (files.length === 0) return;

        console.log(`[Send to X4] uploadFilesToFolder: ${files.length} files to ${targetFolder}`);
        const notice = new Notice(`Uploading ${files.length} files to ${targetFolder}...`, 0);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                console.log(`[Send to X4] Uploading file ${i + 1}/${files.length}: ${file.basename}`);
                notice.setMessage(`Uploading ${i + 1}/${files.length}: ${file.basename}...`);
                const success = await this.queueManager.uploadFileToFolder(file, this.settings, targetFolder);
                console.log(`[Send to X4] Upload result for ${file.basename}: ${success}`);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
                // Add delay between uploads for X4 device stability
                if (i < files.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`[Send to X4] Failed to upload ${file.basename}:`, error);
                failCount++;
            }
        }

        notice.hide();
        console.log(`[Send to X4] Upload complete: ${successCount} succeeded, ${failCount} failed`);
        new Notice(`Upload complete: ${successCount} succeeded, ${failCount} failed`);

        // Refresh tree view
        const existingLeaves = this.app.workspace.getLeavesOfType(X4_TREE_VIEW_TYPE);
        if (existingLeaves.length > 0) {
            const view = existingLeaves[0].view as X4TreeView;
            if (view && typeof view.refresh === 'function') {
                await view.refresh();
            }
        }
    }
}
