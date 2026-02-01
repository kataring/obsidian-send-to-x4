/**
 * X4 Tree View - Shows X4 device file structure in a sidebar
 */

import { ItemView, WorkspaceLeaf, setIcon, Menu, Notice, App, TFile } from 'obsidian';
import { FileItem, SendToX4Settings } from '../types';
import { Uploader } from '../upload/uploader-interface';
import { X4Uploader } from '../upload/x4-uploader';
import { CrossPointUploader } from '../upload/crosspoint-uploader';
import { FilePreviewModal } from './file-preview-modal';

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

export type UploadFilesCallback = (files: File[], targetFolder: string) => Promise<void>;

export type UploadObsidianFilesCallback = (files: TFile[], targetFolder: string) => Promise<void>;

export class X4TreeView extends ItemView {
    private rootEl: HTMLElement | null = null;
    private treeData: TreeNode[] = [];
    private isConnected = false;
    private isLoading = false;
    private getSettings: () => SendToX4Settings;
    private getUploadCallback: () => UploadToFolderCallback;
    private getUploadFilesCallback: () => UploadFilesCallback;
    private getUploadObsidianFilesCallback: () => UploadObsidianFilesCallback;
    private selectionMode = false;
    private selectedItems: Set<string> = new Set();
    private draggedNode: TreeNode | null = null;

    constructor(
        leaf: WorkspaceLeaf,
        getSettings: () => SendToX4Settings,
        getUploadCallback: () => UploadToFolderCallback,
        getUploadFilesCallback?: () => UploadFilesCallback,
        getUploadObsidianFilesCallback?: () => UploadObsidianFilesCallback
    ) {
        super(leaf);
        console.log('[X4TreeView] Constructor called');
        this.getSettings = getSettings;
        this.getUploadCallback = getUploadCallback;
        this.getUploadFilesCallback = getUploadFilesCallback || (() => async () => {});
        this.getUploadObsidianFilesCallback = getUploadObsidianFilesCallback || (() => async () => {});
        console.log('[X4TreeView] Constructor completed');
    }

    private get settings(): SendToX4Settings {
        return this.getSettings();
    }

    private get uploadCallback(): UploadToFolderCallback {
        return this.getUploadCallback();
    }

    private get uploadFilesCallback(): UploadFilesCallback {
        return this.getUploadFilesCallback();
    }

    private get uploadObsidianFilesCallback(): UploadObsidianFilesCallback {
        return this.getUploadObsidianFilesCallback();
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
        console.log('[X4TreeView] onOpen called');
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

        // Setup drop zone for root container
        this.setupRootDropZone(this.rootEl);

        // Show initial message (don't connect automatically)
        const emptyEl = this.rootEl.createDiv({ cls: 'x4-tree-empty' });
        emptyEl.setText('Click refresh to connect to X4');

        // Add styles
        this.addStyles();
        console.log('[X4TreeView] onOpen completed');
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
            .x4-tree-item.dragging {
                opacity: 0.5;
            }
            .x4-tree-item.drag-over {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }
            .x4-tree-container.drag-over-root {
                background: var(--background-modifier-hover);
                border: 2px dashed var(--interactive-accent);
            }
            .x4-tree-item[draggable="true"] {
                cursor: grab;
            }
            .x4-tree-item[draggable="true"]:active {
                cursor: grabbing;
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

    private setupRootDropZone(container: HTMLElement) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Only show drag-over effect if dropping on empty space
            const target = e.target as HTMLElement;
            if (target === container || target.classList.contains('x4-tree-empty')) {
                container.addClass('drag-over-root');
            }
        });

        container.addEventListener('dragleave', (e) => {
            e.preventDefault();
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!container.contains(relatedTarget)) {
                container.removeClass('drag-over-root');
            }
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.removeClass('drag-over-root');

            console.log('[X4TreeView] Drop event on root container');
            console.log('[X4TreeView] draggedNode:', this.draggedNode);
            console.log('[X4TreeView] dataTransfer types:', e.dataTransfer?.types);
            console.log('[X4TreeView] dataTransfer files:', e.dataTransfer?.files?.length);
            console.log('[X4TreeView] text/plain:', e.dataTransfer?.getData('text/plain'));

            // Handle internal drag (move within tree)
            if (this.draggedNode) {
                // Moving to root - construct destination path
                const destPath = '/' + this.draggedNode.name;
                if (this.draggedNode.path !== destPath) {
                    await this.moveNode(this.draggedNode, '/');
                }
                this.draggedNode = null;
                return;
            }

            // Handle drop
            await this.handleDrop(e, '/');
        });
    }

    private getDroppedFiles(e: DragEvent): File[] {
        const files: File[] = [];

        if (e.dataTransfer?.files) {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                files.push(e.dataTransfer.files[i]);
            }
        }

        return files;
    }

    private getObsidianFiles(e: DragEvent): TFile[] {
        const files: TFile[] = [];

        // Try to get Obsidian file paths from text/plain
        const textData = e.dataTransfer?.getData('text/plain');
        if (textData) {
            // Split by newlines in case of multiple files
            const lines = textData.split('\n').filter(p => p.trim());

            for (const line of lines) {
                let filePath: string | null = null;

                // Check if it's an Obsidian URI (obsidian://open?vault=...&file=...)
                if (line.startsWith('obsidian://')) {
                    try {
                        const url = new URL(line);
                        const fileParam = url.searchParams.get('file');
                        if (fileParam) {
                            filePath = decodeURIComponent(fileParam);
                        }
                    } catch (err) {
                        console.log('[X4TreeView] Failed to parse Obsidian URI:', line);
                    }
                } else {
                    // Assume it's a direct file path
                    filePath = line;
                }

                if (filePath) {
                    // Try with and without .md extension
                    let file = this.app.vault.getAbstractFileByPath(filePath);
                    if (!file && !filePath.endsWith('.md')) {
                        file = this.app.vault.getAbstractFileByPath(filePath + '.md');
                    }

                    if (file instanceof TFile) {
                        files.push(file);
                        console.log('[X4TreeView] Found Obsidian file:', file.path);
                    } else {
                        console.log('[X4TreeView] File not found:', filePath);
                    }
                }
            }
        }

        return files;
    }

    private async handleDrop(e: DragEvent, targetFolder: string) {
        if (!this.isConnected) {
            new Notice('Not connected to device');
            return;
        }

        // First, check for Obsidian internal files
        const obsidianFiles = this.getObsidianFiles(e);
        if (obsidianFiles.length > 0) {
            console.log('[X4TreeView] Dropping', obsidianFiles.length, 'Obsidian files to', targetFolder);
            await this.uploadObsidianFilesCallback(obsidianFiles, targetFolder);
            await this.refresh();
            return;
        }

        // Then check for external files
        const files = this.getDroppedFiles(e);
        if (files.length > 0) {
            console.log('[X4TreeView] Dropping', files.length, 'external files to', targetFolder);
            await this.uploadFilesCallback(files, targetFolder);
            await this.refresh();
        }
    }

    private async moveNode(node: TreeNode, targetFolder: string) {
        if (!this.isConnected) {
            new Notice('Not connected to device');
            return;
        }

        // Construct destination path
        let destPath: string;
        if (targetFolder === '/' || targetFolder === '') {
            destPath = '/' + node.name;
        } else {
            const cleanPath = targetFolder.startsWith('/') ? targetFolder : '/' + targetFolder;
            destPath = cleanPath + '/' + node.name;
        }

        // Don't move if source and dest are the same
        if (node.path === destPath) {
            return;
        }

        // Don't allow moving a folder into itself
        if (node.isDirectory && destPath.startsWith(node.path + '/')) {
            new Notice('Cannot move folder into itself');
            return;
        }

        // Show confirmation dialog
        const confirmed = await this.confirmMove(node, targetFolder);
        if (!confirmed) {
            return;
        }

        const notice = new Notice(`Moving ${node.name}...`, 0);

        try {
            const uploader = this.getUploader();
            const success = await uploader.moveItem(node.path, destPath);
            notice.hide();

            if (success) {
                new Notice(`Moved ${node.name}`);
                await this.refresh();
            } else {
                new Notice(`Failed to move ${node.name}`);
            }
        } catch (error) {
            notice.hide();
            console.error('[X4TreeView] Move error:', error);
            new Notice(`Error moving ${node.name}`);
        }
    }

    private confirmMove(node: TreeNode, targetFolder: string): Promise<boolean> {
        return new Promise((resolve) => {
            const itemType = node.isDirectory ? 'folder' : 'file';
            const targetName = targetFolder === '/' ? 'root' : targetFolder;

            const confirmEl = document.createElement('div');
            confirmEl.className = 'x4-move-confirm';
            confirmEl.innerHTML = `
                <div class="x4-move-confirm-content">
                    <p>Move ${itemType} "${node.name}" to ${targetName}?</p>
                    <div class="x4-move-buttons">
                        <button class="x4-move-cancel">Cancel</button>
                        <button class="x4-move-confirm-btn">Move</button>
                    </div>
                </div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .x4-move-confirm {
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
                .x4-move-confirm-content {
                    background: var(--background-primary);
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 400px;
                }
                .x4-move-confirm-content p {
                    margin: 0 0 16px 0;
                }
                .x4-move-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }
                .x4-move-confirm-btn {
                    background: var(--interactive-accent);
                    color: var(--text-on-accent);
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(confirmEl);

            const cleanup = () => {
                confirmEl.remove();
                style.remove();
            };

            const cancelBtn = confirmEl.querySelector('.x4-move-cancel');
            const confirmBtn = confirmEl.querySelector('.x4-move-confirm-btn');

            cancelBtn?.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            confirmBtn?.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            // Close on click outside
            confirmEl.addEventListener('click', (e) => {
                if (e.target === confirmEl) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    private renderNode(node: TreeNode, parentEl: HTMLElement) {
        const itemEl = parentEl.createDiv({ cls: 'x4-tree-item' });

        // Make items draggable (but not in selection mode)
        if (!this.selectionMode) {
            itemEl.setAttribute('draggable', 'true');

            itemEl.addEventListener('dragstart', (e) => {
                this.draggedNode = node;
                itemEl.addClass('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', node.path);
                }
            });

            itemEl.addEventListener('dragend', () => {
                itemEl.removeClass('dragging');
                this.draggedNode = null;
                // Remove all drag-over classes
                this.rootEl?.querySelectorAll('.drag-over').forEach(el => el.removeClass('drag-over'));
            });
        }

        // Folders can receive drops
        if (node.isDirectory) {
            itemEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                // Don't allow dropping on self or parent
                if (this.draggedNode && (this.draggedNode.path === node.path ||
                    (this.draggedNode.isDirectory && node.path.startsWith(this.draggedNode.path + '/')))) {
                    return;
                }
                itemEl.addClass('drag-over');
            });

            itemEl.addEventListener('dragleave', (e) => {
                e.preventDefault();
                itemEl.removeClass('drag-over');
            });

            itemEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                itemEl.removeClass('drag-over');

                console.log('[X4TreeView] Drop event on folder:', node.path);
                console.log('[X4TreeView] draggedNode:', this.draggedNode);
                console.log('[X4TreeView] dataTransfer types:', e.dataTransfer?.types);
                console.log('[X4TreeView] dataTransfer files:', e.dataTransfer?.files?.length);
                console.log('[X4TreeView] text/plain:', e.dataTransfer?.getData('text/plain'));

                // Handle internal drag (move within tree)
                if (this.draggedNode) {
                    if (this.draggedNode.path !== node.path) {
                        await this.moveNode(this.draggedNode, node.path);
                    }
                    this.draggedNode = null;
                    return;
                }

                // Handle file drop (Obsidian or external)
                await this.handleDrop(e, node.path);
            });
        }

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

            // Click handler for files
            itemEl.addEventListener('click', () => {
                if (this.selectionMode) {
                    const newState = !this.selectedItems.has(node.path);
                    this.toggleItemSelection(node, newState);
                    const checkbox = itemEl.querySelector('.x4-tree-item-checkbox') as HTMLInputElement;
                    if (checkbox) checkbox.checked = newState;
                } else {
                    // Open preview modal
                    this.openFilePreview(node);
                }
            });
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

    private openFilePreview(node: TreeNode) {
        if (!this.isConnected) {
            new Notice('Not connected to device');
            return;
        }

        const uploader = this.getUploader();
        const modal = new FilePreviewModal(this.app, node.path, uploader);
        modal.open();
    }

    private showFolderContextMenu(event: MouseEvent, node: TreeNode) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle('Upload to this folder')
                .setIcon('upload')
                .onClick(() => {
                    // Remove leading slash for target folder path
                    const folderPath = node.path.startsWith('/') ? node.path.slice(1) : node.path;
                    this.uploadCallback(folderPath);
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
            item.setTitle('Preview')
                .setIcon('eye')
                .onClick(() => {
                    this.openFilePreview(node);
                });
        });

        menu.addItem((item) => {
            item.setTitle('Download')
                .setIcon('download')
                .onClick(() => {
                    this.downloadFileToLocal(node);
                });
        });

        menu.addSeparator();

        menu.addItem((item) => {
            item.setTitle('Delete file')
                .setIcon('trash')
                .onClick(() => {
                    this.confirmAndDelete(node);
                });
        });

        menu.showAtMouseEvent(event);
    }

    private async downloadFileToLocal(node: TreeNode) {
        if (!this.isConnected) {
            new Notice('Not connected to device');
            return;
        }

        const notice = new Notice(`Downloading ${node.name}...`, 0);

        try {
            const uploader = this.getUploader();
            const data = await uploader.downloadFile(node.path);
            notice.hide();

            if (!data) {
                new Notice(`Failed to download ${node.name}`);
                return;
            }

            // Create download link
            const blob = new Blob([data]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = node.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            new Notice(`Downloaded ${node.name}`);
        } catch (error) {
            notice.hide();
            console.error('[X4TreeView] Download error:', error);
            new Notice(`Error downloading ${node.name}`);
        }
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
