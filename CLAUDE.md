# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

**Send to X4** is an Obsidian plugin that converts Markdown notes to EPUB format and sends them directly to Xtenik X4 e-ink devices over WiFi.

### Key Features

- Markdown to EPUB 2.0 conversion (using JSZip)
- Direct upload to X4 devices over WiFi
- Manual EPUB file download
- Support for both standard X4 firmware and CrossPoint custom firmware
- Upload queue management (pending/uploading/done/failed)
- X4 device file browser (tree view)
- Metadata extraction from YAML frontmatter

## Project Structure

```
src/
├── main.ts                    # Plugin entry point
├── types.ts                   # Type definitions
├── settings.ts                # Settings tab UI
├── epub/
│   ├── epub-builder.ts        # EPUB generation (JSZip)
│   └── epub-templates.ts      # EPUB XML templates
├── queue/
│   └── queue-manager.ts       # Queue management, file processing
├── upload/
│   ├── uploader-interface.ts  # Uploader interface
│   ├── x4-uploader.ts         # Standard X4 firmware uploader
│   └── crosspoint-uploader.ts # CrossPoint firmware uploader
├── utils/
│   ├── markdown-converter.ts  # Markdown to XHTML conversion
│   └── sanitize.ts            # HTML sanitization
└── views/
    ├── x4-tree-view.ts        # Device file tree view
    └── file-picker-modal.ts   # File picker modal
```

## Development Commands

```bash
npm install     # Install dependencies
npm run dev     # Development mode (watch)
npm run build   # Production build
```

## Build System

- **Bundler**: esbuild
- **Language**: TypeScript (ES6 target)
- **Output**: `main.js` (CommonJS format)

## Key Type Definitions

```typescript
// src/types.ts
interface SendToX4Settings {
  useCrosspointFirmware: boolean;
  targetFolder: string;
  x4Ip: string;
  crosspointIp: string;
}

interface QueueItem {
  id: string;
  title: string;
  filePath: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  error?: string;
}

interface ArticleData {
  title: string;
  author: string;
  date: string;
  body: string;
  url?: string;
}
```

## Architecture

### Processing Flow

```
User Action → QueueManager.uploadFile()
  → Read file
  → Extract metadata (YAML frontmatter)
  → Convert Markdown to XHTML
  → Sanitize HTML
  → EpubBuilder.build() (create ZIP structure)
  → Select Uploader (X4 or CrossPoint)
  → Upload via HTTP multipart
```

### Firmware-specific Endpoints

| Firmware | List Files | Upload | Delete |
|----------|-----------|--------|--------|
| Standard X4 | GET `/list` | POST `/edit` | DELETE `/edit` |
| CrossPoint | GET `/api/files` | POST `/upload` | DELETE (not implemented) |

## Commands

| Command ID | Description |
|------------|-------------|
| `send-current-note` | Send current note to X4 |
| `upload-queue` | Upload all items in queue |
| `download-epub` | Download current note as EPUB |
| `open-x4-files` | Open X4 file browser |

## Dependencies

- `jszip` (3.10.1): EPUB ZIP structure generation
- `obsidian`: Obsidian API (devDependency)
- `esbuild`: Bundler
- `typescript`: Type checking
