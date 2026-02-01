/**
 * Send to X4 - Obsidian Plugin
 * Convert Obsidian notes to EPUB and send to Xtenik X4 e-ink reader
 */

import { Plugin, TFile, Notice } from 'obsidian';
import { SendToX4Settings, DEFAULT_SETTINGS } from './types';
import { SendToX4SettingTab } from './settings';
import { QueueManager } from './queue/queue-manager';
import { X4TreeView, X4_TREE_VIEW_TYPE, UploadFilesCallback, UploadObsidianFilesCallback } from './views/x4-tree-view';
import { X4Uploader } from './upload/x4-uploader';
import { CrossPointUploader } from './upload/crosspoint-uploader';
import { FilePickerModal } from './views/file-picker-modal';

export default class SendToX4Plugin extends Plugin {
    settings: SendToX4Settings = DEFAULT_SETTINGS;
    queueManager: QueueManager = null!;

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
                    () => (targetFolder: string) => this.showFilePicker(targetFolder),
                    () => (files: File[], targetFolder: string) => this.uploadDroppedFiles(files, targetFolder),
                    () => (files: TFile[], targetFolder: string) => this.uploadObsidianFiles(files, targetFolder)
                );
            }
        );
        console.log('[Send to X4] View registered');

        // Add settings tab
        this.addSettingTab(new SendToX4SettingTab(this.app, this));

        // Add ribbon icon for X4 file browser
        this.addRibbonIcon('hard-drive', 'X4 Files', () => {
            this.activateTreeView();
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
            const { data, filename } = await this.queueManager.generateEpub(activeFile, this.settings.filenameFormat);

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
     * Upload Obsidian files (from drag and drop within Obsidian) to the specified folder on X4
     * Markdown files are converted to EPUB, other files are uploaded as-is
     */
    private async uploadObsidianFiles(files: TFile[], targetFolder: string): Promise<void> {
        if (files.length === 0) return;

        console.log(`[Send to X4] uploadObsidianFiles: ${files.length} files to ${targetFolder}`);
        const notice = new Notice(`Uploading ${files.length} files to ${targetFolder}...`, 0);
        let successCount = 0;
        let failCount = 0;

        const uploader = this.settings.useCrosspointFirmware
            ? new CrossPointUploader(this.settings.crosspointIp)
            : new X4Uploader(this.settings.x4Ip);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                console.log(`[Send to X4] Uploading file ${i + 1}/${files.length}: ${file.name}`);
                notice.setMessage(`Uploading ${i + 1}/${files.length}: ${file.name}...`);

                let success = false;

                if (file.extension === 'md') {
                    // Convert markdown to EPUB and upload
                    success = await this.queueManager.uploadFileToFolder(file, this.settings, targetFolder);
                } else {
                    // Upload as raw file
                    const arrayBuffer = await this.app.vault.readBinary(file);
                    success = await uploader.uploadRawFile(arrayBuffer, file.name, targetFolder);
                }

                console.log(`[Send to X4] Upload result for ${file.name}: ${success}`);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }

                // Add delay between uploads for device stability
                if (i < files.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`[Send to X4] Failed to upload ${file.name}:`, error);
                failCount++;
            }
        }

        notice.hide();
        console.log(`[Send to X4] Upload complete: ${successCount} succeeded, ${failCount} failed`);
        new Notice(`Upload complete: ${successCount} succeeded, ${failCount} failed`);
    }

    /**
     * Upload dropped files (from drag and drop) to the specified folder on X4
     */
    private async uploadDroppedFiles(files: File[], targetFolder: string): Promise<void> {
        if (files.length === 0) return;

        console.log(`[Send to X4] uploadDroppedFiles: ${files.length} files to ${targetFolder}`);
        const notice = new Notice(`Uploading ${files.length} files to ${targetFolder}...`, 0);
        let successCount = 0;
        let failCount = 0;

        const uploader = this.settings.useCrosspointFirmware
            ? new CrossPointUploader(this.settings.crosspointIp)
            : new X4Uploader(this.settings.x4Ip);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                console.log(`[Send to X4] Uploading file ${i + 1}/${files.length}: ${file.name}`);
                notice.setMessage(`Uploading ${i + 1}/${files.length}: ${file.name}...`);

                const arrayBuffer = await file.arrayBuffer();
                const success = await uploader.uploadRawFile(arrayBuffer, file.name, targetFolder);

                console.log(`[Send to X4] Upload result for ${file.name}: ${success}`);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }

                // Add delay between uploads for device stability
                if (i < files.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`[Send to X4] Failed to upload ${file.name}:`, error);
                failCount++;
            }
        }

        notice.hide();
        console.log(`[Send to X4] Upload complete: ${successCount} succeeded, ${failCount} failed`);
        new Notice(`Upload complete: ${successCount} succeeded, ${failCount} failed`);
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
