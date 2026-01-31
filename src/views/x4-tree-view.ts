/**
 * X4 Tree View - Shows X4 device file structure in a sidebar
 */

import { ItemView, WorkspaceLeaf, setIcon, Menu, Notice } from 'obsidian';
import { FileItem, SendToX4Settings } from '../types';
import { Uploader } from '../upload/uploader-interface';
import { X4Uploader } from '../upload/x4-uploader';
import { CrossPointUploader } from '../upload/crosspoint-uploader';

export const X4_TREE_VIEW_TYPE = 'x4-tree-view';

interface TreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
    children?: TreeNode[];
    expanded?: boolean;
}

export type UploadToFolderCallback = (targetFolder: string) => void;

export class X4TreeView extends ItemView {
    private settings: SendToX4Settings;
    private rootEl: HTMLElement | null = null;
    private treeData: TreeNode[] = [];
    private isConnected = false;
    private isLoading = false;
    private getSettings: () => SendToX4Settings;
    private onUploadToFolder: UploadToFolderCallback | null = null;
    private selectionMode = false;
    private selectedItems: Set<string> = new Set();

    constructor(leaf: WorkspaceLeaf, getSettings: () => SendToX4Settings) {
        super(leaf);
        this.getSettings = getSettings;
        this.settings = getSettings();
    }

    setUploadCallback(callback: UploadToFolderCallback) {
        this.onUploadToFolder = callback;
    }

    getViewType(): string {
        return X4_TREE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'X4 Files';
    }

    getIcon(): string {
        return 'hard-drive';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('x4-tree-view');

        // Create header
        const header = container.createDiv({ cls: 'x4-tree-header' });

        const titleEl = header.createDiv({ cls: 'x4-tree-title' });
        titleEl.setText('X4 Device');

        const headerButtons = header.createDiv({ cls: 'x4-tree-header-buttons' });

        // New folder button
        const newFolderBtn = headerButtons.createDiv({ cls: 'x4-tree-btn clickable-icon' });
        setIcon(newFolderBtn, 'folder-plus');
        newFolderBtn.setAttribute('aria-label', 'New Folder');
        newFolderBtn.addEventListener('click', () => this.showCreateFolderDialog('/'));

        // Select mode toggle button
        const selectBtn = headerButtons.createDiv({ cls: 'x4-tree-btn clickable-icon' });
        setIcon(selectBtn, 'check-square');
        selectBtn.setAttribute('aria-label', 'Select Mode');
        selectBtn.addEventListener('click', () => this.toggleSelectionMode());

        // Delete selected button (hidden by default)
        const deleteBtn = headerButtons.createDiv({ cls: 'x4-tree-btn x4-tree-delete-btn clickable-icon' });
        deleteBtn.style.display = 'none';
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.setAttribute('aria-label', 'Delete Selected');
        deleteBtn.addEventListener('click', () => this.deleteSelected());

        // Refresh button
        const refreshBtn = headerButtons.createDiv({ cls: 'x4-tree-btn clickable-icon' });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.setAttribute('aria-label', 'Refresh');
        refreshBtn.addEventListener('click', () => this.refresh());

        // Create status area
        const statusEl = container.createDiv({ cls: 'x4-tree-status' });
        this.updateStatus(statusEl);

        // Create tree container
        this.rootEl = container.createDiv({ cls: 'x4-tree-container' });

        // Add styles
        this.addStyles();

        // Initial load
        await this.refresh();
    }

    async onClose() {
        // Cleanup if needed
    }

    private addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .x4-tree-view {
                padding: 0;
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            .x4-tree-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .x4-tree-title {
                font-weight: 600;
                font-size: 14px;
            }
            .x4-tree-header-buttons {
                display: flex;
                gap: 4px;
            }
            .x4-tree-btn {
                cursor: pointer;
                opacity: 0.7;
            }
            .x4-tree-btn:hover {
                opacity: 1;
            }
            .x4-tree-btn.active {
                opacity: 1;
                color: var(--interactive-accent);
            }
            .x4-tree-delete-btn {
                color: var(--text-error);
            }
            .x4-tree-status {
                padding: 8px 12px;
                font-size: 12px;
                color: var(--text-muted);
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .x4-tree-status.connected {
                color: var(--text-success);
            }
            .x4-tree-status.disconnected {
                color: var(--text-error);
            }
            .x4-tree-container {
                flex: 1;
                overflow-y: auto;
                padding: 4px 0;
            }
            .x4-tree-item {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                cursor: pointer;
                user-select: none;
            }
            .x4-tree-item:hover {
                background: var(--background-modifier-hover);
            }
            .x4-tree-item-icon {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 4px;
                flex-shrink: 0;
            }
            .x4-tree-item-toggle {
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 2px;
                flex-shrink: 0;
                opacity: 0.5;
            }
            .x4-tree-item-toggle:hover {
                opacity: 1;
            }
            .x4-tree-item-toggle.collapsed svg {
                transform: rotate(-90deg);
            }
            .x4-tree-item-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 13px;
            }
            .x4-tree-item-size {
                font-size: 11px;
                color: var(--text-muted);
                margin-left: 8px;
            }
            .x4-tree-children {
                padding-left: 16px;
            }
            .x4-tree-empty {
                padding: 16px;
                text-align: center;
                color: var(--text-muted);
                font-size: 13px;
            }
            .x4-tree-loading {
                padding: 16px;
                text-align: center;
                color: var(--text-muted);
            }
            .x4-tree-item-checkbox {
                width: 16px;
                height: 16px;
                margin-right: 6px;
                flex-shrink: 0;
                cursor: pointer;
                accent-color: var(--interactive-accent);
            }
            .x4-tree-item.selected {
                background: var(--background-modifier-hover);
            }
            .x4-create-folder-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            .x4-create-folder-content {
                background: var(--background-primary);
                padding: 20px;
                border-radius: 8px;
                min-width: 300px;
            }
            .x4-create-folder-content h3 {
                margin: 0 0 12px 0;
                font-size: 16px;
            }
            .x4-create-folder-content input {
                width: 100%;
                padding: 8px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                background: var(--background-secondary);
                color: var(--text-normal);
                margin-bottom: 12px;
            }
            .x4-create-folder-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    private updateStatus(statusEl: HTMLElement) {
        statusEl.empty();
        statusEl.removeClass('connected', 'disconnected');

        if (this.isLoading) {
            statusEl.setText('Connecting...');
        } else if (this.isConnected) {
            statusEl.addClass('connected');
            const deviceType = this.settings.useCrosspointFirmware ? 'CrossPoint' : 'X4';
            const ip = this.settings.useCrosspointFirmware ? this.settings.crosspointIp : this.settings.x4Ip;
            statusEl.setText(`Connected to ${deviceType} (${ip})`);
        } else {
            statusEl.addClass('disconnected');
            statusEl.setText('Not connected');
        }
    }

    async refresh() {
        this.settings = this.getSettings();

        if (!this.rootEl) return;

        this.isLoading = true;
        const statusEl = this.containerEl.querySelector('.x4-tree-status') as HTMLElement;
        if (statusEl) this.updateStatus(statusEl);

        this.rootEl.empty();
        const loadingEl = this.rootEl.createDiv({ cls: 'x4-tree-loading' });
        loadingEl.setText('Loading...');

        try {
            const uploader = this.getUploader();
            this.isConnected = await uploader.isConnected();

            if (!this.isConnected) {
                this.isLoading = false;
                if (statusEl) this.updateStatus(statusEl);
                this.rootEl.empty();
                const emptyEl = this.rootEl.createDiv({ cls: 'x4-tree-empty' });
                emptyEl.setText('Connect to X4 WiFi to view files');
                return;
            }

            // Load root directory
            const items = await uploader.listDirectory('/');
            this.isLoading = false;
            if (statusEl) this.updateStatus(statusEl);

            if (!items || items.length === 0) {
                this.rootEl.empty();
                const emptyEl = this.rootEl.createDiv({ cls: 'x4-tree-empty' });
                emptyEl.setText('No files on device');
                return;
            }

            // Convert to tree nodes
            this.treeData = items.map(item => ({
                name: item.name,
                path: '/' + item.name,
                isDirectory: item.isDirectory,
                size: item.size,
                expanded: false
            }));

            // Sort: directories first, then alphabetically
            this.treeData.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            this.renderTree();
        } catch (error) {
            console.error('[X4TreeView] Error refreshing:', error);
            this.isLoading = false;
            this.isConnected = false;
            if (statusEl) this.updateStatus(statusEl);
            this.rootEl.empty();
            const emptyEl = this.rootEl.createDiv({ cls: 'x4-tree-empty' });
            emptyEl.setText('Error loading files');
        }
    }

    private renderTree() {
        if (!this.rootEl) return;
        this.rootEl.empty();

        for (const node of this.treeData) {
            this.renderNode(node, this.rootEl);
        }
    }

    private renderNode(node: TreeNode, parentEl: HTMLElement) {
        const itemEl = parentEl.createDiv({ cls: 'x4-tree-item' });

        // Add selected class if selected
        if (this.selectedItems.has(node.path)) {
            itemEl.addClass('selected');
        }

        // Checkbox for selection mode
        if (this.selectionMode) {
            const checkbox = itemEl.createEl('input', {
                cls: 'x4-tree-item-checkbox',
                type: 'checkbox'
            }) as HTMLInputElement;
            checkbox.checked = this.selectedItems.has(node.path);
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            checkbox.addEventListener('change', () => {
                this.toggleItemSelection(node, checkbox.checked);
            });
        }

        // Toggle for directories
        if (node.isDirectory) {
            const toggleEl = itemEl.createDiv({ cls: 'x4-tree-item-toggle' });
            if (!node.expanded) {
                toggleEl.addClass('collapsed');
            }
            setIcon(toggleEl, 'chevron-down');
            toggleEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNode(node, itemEl);
            });

            // Context menu for folders
            itemEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showFolderContextMenu(e, node);
            });

            // Click to expand/collapse (only if not in selection mode, or if clicking non-checkbox area)
            itemEl.addEventListener('click', (e) => {
                if (this.selectionMode) {
                    // In selection mode, toggle selection on item click
                    const newState = !this.selectedItems.has(node.path);
                    this.toggleItemSelection(node, newState);
                    const checkbox = itemEl.querySelector('.x4-tree-item-checkbox') as HTMLInputElement;
                    if (checkbox) checkbox.checked = newState;
                } else {
                    this.toggleNode(node, itemEl);
                }
            });
        } else {
            // Placeholder for alignment
            itemEl.createDiv({ cls: 'x4-tree-item-toggle' });

            // Context menu for files
            itemEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showFileContextMenu(e, node);
            });

            // Click handler for files in selection mode
            if (this.selectionMode) {
                itemEl.addEventListener('click', () => {
                    const newState = !this.selectedItems.has(node.path);
                    this.toggleItemSelection(node, newState);
                    const checkbox = itemEl.querySelector('.x4-tree-item-checkbox') as HTMLInputElement;
                    if (checkbox) checkbox.checked = newState;
                });
            }
        }

        // Icon
        const iconEl = itemEl.createDiv({ cls: 'x4-tree-item-icon' });
        if (node.isDirectory) {
            setIcon(iconEl, node.expanded ? 'folder-open' : 'folder');
        } else {
            const icon = this.getFileIcon(node.name);
            setIcon(iconEl, icon);
        }

        // Name
        const nameEl = itemEl.createDiv({ cls: 'x4-tree-item-name' });
        nameEl.setText(node.name);

        // Size for files
        if (!node.isDirectory && node.size !== undefined) {
            const sizeEl = itemEl.createDiv({ cls: 'x4-tree-item-size' });
            sizeEl.setText(this.formatSize(node.size));
        }

        // Children container
        if (node.isDirectory && node.expanded && node.children) {
            const childrenEl = parentEl.createDiv({ cls: 'x4-tree-children' });
            for (const child of node.children) {
                this.renderNode(child, childrenEl);
            }
        }
    }

    private showFolderContextMenu(event: MouseEvent, node: TreeNode) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle('Upload to this folder')
                .setIcon('upload')
                .onClick(() => {
                    if (this.onUploadToFolder) {
                        // Remove leading slash for target folder path
                        const folderPath = node.path.startsWith('/') ? node.path.slice(1) : node.path;
                        this.onUploadToFolder(folderPath);
                    }
                });
        });

        menu.addItem((item) => {
            item.setTitle('New folder here')
                .setIcon('folder-plus')
                .onClick(() => {
                    this.showCreateFolderDialog(node.path);
                });
        });

        menu.addSeparator();

        menu.addItem((item) => {
            item.setTitle('Delete folder')
                .setIcon('trash')
                .onClick(() => {
                    this.confirmAndDelete(node);
                });
        });

        menu.showAtMouseEvent(event);
    }

    private showFileContextMenu(event: MouseEvent, node: TreeNode) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle('Delete file')
                .setIcon('trash')
                .onClick(() => {
                    this.confirmAndDelete(node);
                });
        });

        menu.showAtMouseEvent(event);
    }

    private async confirmAndDelete(node: TreeNode) {
        const itemType = node.isDirectory ? 'folder' : 'file';

        // Create confirmation modal
        const confirmEl = document.createElement('div');
        confirmEl.className = 'x4-delete-confirm';
        confirmEl.innerHTML = `
            <div class="x4-delete-confirm-content">
                <p>Delete ${itemType} "${node.name}"?</p>
                ${node.isDirectory ? '<p class="x4-delete-warning">This will delete all contents inside the folder.</p>' : ''}
                <div class="x4-delete-buttons">
                    <button class="x4-delete-cancel">Cancel</button>
                    <button class="x4-delete-confirm-btn mod-warning">Delete</button>
                </div>
            </div>
        `;

        // Add styles for confirm dialog
        const style = document.createElement('style');
        style.textContent = `
            .x4-delete-confirm {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            .x4-delete-confirm-content {
                background: var(--background-primary);
                padding: 20px;
                border-radius: 8px;
                max-width: 400px;
            }
            .x4-delete-warning {
                color: var(--text-error);
                font-size: 13px;
            }
            .x4-delete-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 16px;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(confirmEl);

        return new Promise<void>((resolve) => {
            const cancelBtn = confirmEl.querySelector('.x4-delete-cancel');
            const confirmBtn = confirmEl.querySelector('.x4-delete-confirm-btn');

            const cleanup = () => {
                confirmEl.remove();
                style.remove();
                resolve();
            };

            cancelBtn?.addEventListener('click', cleanup);

            confirmBtn?.addEventListener('click', async () => {
                const notice = new Notice(`Deleting ${node.name}...`, 0);
                const uploader = this.getUploader();
                const success = await uploader.deleteItem(node.path);
                notice.hide();

                if (success) {
                    new Notice(`Deleted ${node.name}`);
                    await this.refresh();
                } else {
                    new Notice(`Failed to delete ${node.name}`);
                }
                cleanup();
            });
        });
    }

    private async toggleNode(node: TreeNode, itemEl: HTMLElement) {
        node.expanded = !node.expanded;

        if (node.expanded && !node.children) {
            // Load children
            const uploader = this.getUploader();
            const items = await uploader.listDirectory(node.path);

            if (items) {
                node.children = items.map(item => ({
                    name: item.name,
                    path: node.path + '/' + item.name,
                    isDirectory: item.isDirectory,
                    size: item.size,
                    expanded: false
                }));

                // Sort children
                node.children.sort((a, b) => {
                    if (a.isDirectory !== b.isDirectory) {
                        return a.isDirectory ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });
            }
        }

        this.renderTree();
    }

    private getUploader(): Uploader {
        if (this.settings.useCrosspointFirmware) {
            return new CrossPointUploader(this.settings.crosspointIp);
        }
        return new X4Uploader(this.settings.x4Ip);
    }

    private getFileIcon(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase() || '';

        switch (ext) {
            case 'epub':
                return 'book';
            case 'pdf':
                return 'file-text';
            case 'txt':
                return 'file-text';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return 'image';
            default:
                return 'file';
        }
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    private toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        if (!this.selectionMode) {
            this.selectedItems.clear();
        }

        // Update select button appearance
        const selectBtn = this.containerEl.querySelector('.x4-tree-btn[aria-label="Select Mode"]');
        if (selectBtn) {
            if (this.selectionMode) {
                selectBtn.addClass('active');
            } else {
                selectBtn.removeClass('active');
            }
        }

        this.updateDeleteButtonVisibility();
        this.renderTree();
    }

    private toggleItemSelection(node: TreeNode, selected: boolean) {
        if (selected) {
            this.selectedItems.add(node.path);
        } else {
            this.selectedItems.delete(node.path);
        }
        this.updateDeleteButtonVisibility();
    }

    private updateDeleteButtonVisibility() {
        const deleteBtn = this.containerEl.querySelector('.x4-tree-delete-btn') as HTMLElement;
        if (deleteBtn) {
            if (this.selectionMode && this.selectedItems.size > 0) {
                deleteBtn.style.display = '';
            } else {
                deleteBtn.style.display = 'none';
            }
        }
    }

    private async deleteSelected() {
        if (this.selectedItems.size === 0) return;

        const count = this.selectedItems.size;
        const itemWord = count === 1 ? 'item' : 'items';

        // Create confirmation modal
        const confirmEl = document.createElement('div');
        confirmEl.className = 'x4-delete-confirm';
        confirmEl.innerHTML = `
            <div class="x4-delete-confirm-content">
                <p>Delete ${count} ${itemWord}?</p>
                <p class="x4-delete-warning">This action cannot be undone.</p>
                <div class="x4-delete-buttons">
                    <button class="x4-delete-cancel">Cancel</button>
                    <button class="x4-delete-confirm-btn mod-warning">Delete</button>
                </div>
            </div>
        `;

        // Add styles for confirm dialog (reuse from confirmAndDelete)
        const style = document.createElement('style');
        style.textContent = `
            .x4-delete-confirm {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            .x4-delete-confirm-content {
                background: var(--background-primary);
                padding: 20px;
                border-radius: 8px;
                max-width: 400px;
            }
            .x4-delete-warning {
                color: var(--text-error);
                font-size: 13px;
            }
            .x4-delete-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 16px;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(confirmEl);

        return new Promise<void>((resolve) => {
            const cancelBtn = confirmEl.querySelector('.x4-delete-cancel');
            const confirmBtn = confirmEl.querySelector('.x4-delete-confirm-btn');

            const cleanup = () => {
                confirmEl.remove();
                style.remove();
                resolve();
            };

            cancelBtn?.addEventListener('click', cleanup);

            confirmBtn?.addEventListener('click', async () => {
                const notice = new Notice(`Deleting ${count} ${itemWord}...`, 0);
                const uploader = this.getUploader();

                let successCount = 0;
                let failCount = 0;

                // Delete items one by one
                for (const path of this.selectedItems) {
                    const success = await uploader.deleteItem(path);
                    if (success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                }

                notice.hide();

                if (failCount === 0) {
                    new Notice(`Deleted ${successCount} ${itemWord}`);
                } else {
                    new Notice(`Deleted ${successCount}, failed ${failCount}`);
                }

                this.selectedItems.clear();
                this.selectionMode = false;
                this.updateDeleteButtonVisibility();

                // Update select button appearance
                const selectBtn = this.containerEl.querySelector('.x4-tree-btn[aria-label="Select Mode"]');
                if (selectBtn) {
                    selectBtn.removeClass('active');
                }

                await this.refresh();
                cleanup();
            });
        });
    }

    private showCreateFolderDialog(parentPath: string) {
        if (!this.isConnected) {
            new Notice('Not connected to device');
            return;
        }

        const dialogEl = document.createElement('div');
        dialogEl.className = 'x4-create-folder-dialog';
        dialogEl.innerHTML = `
            <div class="x4-create-folder-content">
                <h3>Create New Folder</h3>
                <input type="text" placeholder="Folder name" class="x4-folder-name-input">
                <div class="x4-create-folder-buttons">
                    <button class="x4-folder-cancel">Cancel</button>
                    <button class="x4-folder-create">Create</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialogEl);

        const input = dialogEl.querySelector('.x4-folder-name-input') as HTMLInputElement;
        const cancelBtn = dialogEl.querySelector('.x4-folder-cancel');
        const createBtn = dialogEl.querySelector('.x4-folder-create');

        input.focus();

        const cleanup = () => {
            dialogEl.remove();
        };

        const createFolder = async () => {
            const folderName = input.value.trim();
            if (!folderName) {
                new Notice('Please enter a folder name');
                return;
            }

            // Validate folder name (no special characters)
            if (!/^[a-zA-Z0-9_\-. ]+$/.test(folderName)) {
                new Notice('Invalid folder name. Use only letters, numbers, spaces, underscores, hyphens, and dots.');
                return;
            }

            const notice = new Notice(`Creating folder "${folderName}"...`, 0);
            const uploader = this.getUploader();
            const success = await uploader.createFolder(folderName, parentPath);
            notice.hide();

            if (success) {
                new Notice(`Created folder "${folderName}"`);
                await this.refresh();
            } else {
                new Notice(`Failed to create folder "${folderName}"`);
            }

            cleanup();
        };

        cancelBtn?.addEventListener('click', cleanup);
        createBtn?.addEventListener('click', createFolder);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                createFolder();
            } else if (e.key === 'Escape') {
                cleanup();
            }
        });
    }
}
