/**
 * File Picker Modal - Select markdown files to upload
 */

import { App, Modal, TFile, setIcon } from 'obsidian';

export class FilePickerModal extends Modal {
    private selectedFiles: Set<TFile> = new Set();
    private onSubmit: (files: TFile[]) => void;
    private targetFolder: string;
    private searchInput: HTMLInputElement | null = null;
    private fileListEl: HTMLElement | null = null;
    private allFiles: TFile[] = [];

    constructor(app: App, targetFolder: string, onSubmit: (files: TFile[]) => void) {
        super(app);
        this.targetFolder = targetFolder;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('x4-file-picker-modal');

        // Header
        const headerEl = contentEl.createDiv({ cls: 'x4-file-picker-header' });
        headerEl.createEl('h2', { text: `Upload to: ${this.targetFolder}` });

        // Search input
        const searchContainer = contentEl.createDiv({ cls: 'x4-file-picker-search' });
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search notes...',
            cls: 'x4-file-picker-search-input'
        });
        this.searchInput.addEventListener('input', () => this.filterFiles());

        // File list
        this.fileListEl = contentEl.createDiv({ cls: 'x4-file-picker-list' });

        // Get all markdown files
        this.allFiles = this.app.vault.getMarkdownFiles();
        this.allFiles.sort((a, b) => a.path.localeCompare(b.path));
        this.renderFileList(this.allFiles);

        // Footer with buttons
        const footerEl = contentEl.createDiv({ cls: 'x4-file-picker-footer' });

        const selectedCountEl = footerEl.createSpan({ cls: 'x4-file-picker-selected-count' });
        selectedCountEl.setText('0 selected');

        const buttonsEl = footerEl.createDiv({ cls: 'x4-file-picker-buttons' });

        const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const uploadBtn = buttonsEl.createEl('button', { text: 'Upload', cls: 'mod-cta' });
        uploadBtn.addEventListener('click', () => {
            if (this.selectedFiles.size > 0) {
                this.onSubmit(Array.from(this.selectedFiles));
                this.close();
            }
        });

        // Add styles
        this.addStyles();

        // Focus search input
        this.searchInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private filterFiles() {
        const query = this.searchInput?.value.toLowerCase() || '';
        const filteredFiles = this.allFiles.filter(file =>
            file.path.toLowerCase().includes(query) ||
            file.basename.toLowerCase().includes(query)
        );
        this.renderFileList(filteredFiles);
    }

    private renderFileList(files: TFile[]) {
        if (!this.fileListEl) return;
        this.fileListEl.empty();

        if (files.length === 0) {
            const emptyEl = this.fileListEl.createDiv({ cls: 'x4-file-picker-empty' });
            emptyEl.setText('No matching files');
            return;
        }

        for (const file of files) {
            const itemEl = this.fileListEl.createDiv({ cls: 'x4-file-picker-item' });
            if (this.selectedFiles.has(file)) {
                itemEl.addClass('selected');
            }

            const checkboxEl = itemEl.createDiv({ cls: 'x4-file-picker-checkbox' });
            if (this.selectedFiles.has(file)) {
                setIcon(checkboxEl, 'check-square');
            } else {
                setIcon(checkboxEl, 'square');
            }

            const iconEl = itemEl.createDiv({ cls: 'x4-file-picker-icon' });
            setIcon(iconEl, 'file-text');

            const infoEl = itemEl.createDiv({ cls: 'x4-file-picker-info' });
            const nameEl = infoEl.createDiv({ cls: 'x4-file-picker-name' });
            nameEl.setText(file.basename);
            const pathEl = infoEl.createDiv({ cls: 'x4-file-picker-path' });
            pathEl.setText(file.parent?.path || '/');

            itemEl.addEventListener('click', () => {
                this.toggleFile(file, itemEl, checkboxEl);
            });
        }
    }

    private toggleFile(file: TFile, itemEl: HTMLElement, checkboxEl: HTMLElement) {
        if (this.selectedFiles.has(file)) {
            this.selectedFiles.delete(file);
            itemEl.removeClass('selected');
            setIcon(checkboxEl, 'square');
        } else {
            this.selectedFiles.add(file);
            itemEl.addClass('selected');
            setIcon(checkboxEl, 'check-square');
        }

        // Update selected count
        const countEl = this.contentEl.querySelector('.x4-file-picker-selected-count');
        if (countEl) {
            countEl.setText(`${this.selectedFiles.size} selected`);
        }
    }

    private addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .x4-file-picker-modal {
                width: 500px;
                max-width: 90vw;
            }
            .x4-file-picker-header h2 {
                margin: 0 0 16px 0;
                font-size: 18px;
            }
            .x4-file-picker-search {
                margin-bottom: 12px;
            }
            .x4-file-picker-search-input {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                background: var(--background-primary);
                color: var(--text-normal);
            }
            .x4-file-picker-list {
                max-height: 400px;
                overflow-y: auto;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                margin-bottom: 16px;
            }
            .x4-file-picker-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .x4-file-picker-item:last-child {
                border-bottom: none;
            }
            .x4-file-picker-item:hover {
                background: var(--background-modifier-hover);
            }
            .x4-file-picker-item.selected {
                background: var(--interactive-accent-hover);
            }
            .x4-file-picker-checkbox {
                width: 20px;
                height: 20px;
                margin-right: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .x4-file-picker-icon {
                width: 20px;
                height: 20px;
                margin-right: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-muted);
            }
            .x4-file-picker-info {
                flex: 1;
                min-width: 0;
            }
            .x4-file-picker-name {
                font-size: 14px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .x4-file-picker-path {
                font-size: 11px;
                color: var(--text-muted);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .x4-file-picker-empty {
                padding: 24px;
                text-align: center;
                color: var(--text-muted);
            }
            .x4-file-picker-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .x4-file-picker-selected-count {
                color: var(--text-muted);
                font-size: 13px;
            }
            .x4-file-picker-buttons {
                display: flex;
                gap: 8px;
            }
            .x4-file-picker-buttons button {
                padding: 6px 16px;
            }
        `;
        document.head.appendChild(style);
    }
}
