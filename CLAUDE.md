# CLAUDE.md - AI Assistant Guide for obsidian-send-to-x4

## Project Overview

This is an **Obsidian plugin** that converts Markdown notes to EPUB format and uploads them to Xtenik X4 e-ink devices via WiFi. The plugin supports both standard X4 firmware and CrossPoint custom firmware.

**Key capabilities:**
- Markdown to EPUB conversion using Obsidian's MarkdownRenderer
- Direct WiFi upload to X4 devices
- Watch folder for automatic queuing and uploading
- Queue management with persistence
- Manual EPUB download without device upload

## Codebase Structure

```
src/
├── main.ts                      # Plugin entry point, commands, event handlers
├── settings.ts                  # Settings tab UI (PluginSettingTab)
├── types.ts                     # TypeScript interfaces and default settings
├── epub/
│   ├── epub-builder.ts          # EPUB generation using JSZip
│   └── epub-templates.ts        # EPUB XML/XHTML templates
├── queue/
│   └── queue-manager.ts         # Upload queue management, file processing
├── upload/
│   ├── uploader-interface.ts    # Common Uploader interface
│   ├── x4-uploader.ts           # Standard X4 firmware uploader
│   └── crosspoint-uploader.ts   # CrossPoint firmware uploader
└── utils/
    ├── markdown-converter.ts    # Markdown to XHTML conversion, frontmatter extraction
    └── sanitize.ts              # HTML sanitization, filename sanitization
```

## Architecture

### Plugin Lifecycle (`main.ts`)
- `onload()`: Initializes queue manager, loads settings, registers commands/events, starts connection checker
- `onunload()`: Cleans up connection check interval
- Auto-upload runs every 30 seconds when device is connected and queue has pending items

### Key Classes

**SendToX4Plugin** (`main.ts:11`)
- Main plugin class extending Obsidian's `Plugin`
- Manages settings, queue persistence, status bar, and user interactions
- Registers commands: `send-current-note`, `upload-queue`, `download-epub`

**QueueManager** (`queue/queue-manager.ts:14`)
- Manages queue of files to upload
- Coordinates between EPUB builder and uploaders
- Handles queue persistence via `loadQueue()`/`exportQueue()`

**EpubBuilder** (`epub/epub-builder.ts:11`)
- Generates EPUB 2.0 files using JSZip
- Structure: mimetype, META-INF/container.xml, OEBPS/{content.opf, toc.ncx, content.xhtml}

**Uploaders** (`upload/`)
- `Uploader` interface: `isConnected()`, `uploadEpub()`
- `X4Uploader`: Standard firmware (default IP: 192.168.3.3)
  - API: GET `/list?dir=/`, PUT/POST `/edit`
- `CrossPointUploader`: CrossPoint firmware (default IP: 192.168.4.1)
  - API: GET `/api/files?path=/`, POST `/upload?path=/`, POST `/mkdir`

### Data Flow

```
TFile (Markdown)
  → extractMetadata (title, author, date from frontmatter)
  → stripFrontmatter → MarkdownRenderer → cleanForEpub → XHTML
  → EpubBuilder.build() → ArrayBuffer (EPUB)
  → Uploader.uploadEpub() → Device
```

## TypeScript Interfaces (`types.ts`)

```typescript
interface SendToX4Settings {
    useCrosspointFirmware: boolean;  // Toggle firmware type
    targetFolder: string;            // Device folder for uploads
    x4Ip: string;                    // Standard X4 IP
    crosspointIp: string;            // CrossPoint IP
    watchFolderEnabled: boolean;     // Enable watch folder
    watchFolder: string;             // Vault folder to watch
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
    body: string;  // XHTML content
    url?: string;
}
```

## Development Workflow

### Build Commands
```bash
npm install          # Install dependencies
npm run dev          # Development mode with watch
npm run build        # Production build (type-check + bundle)
```

### Build Configuration
- **Bundler**: esbuild (`esbuild.config.mjs`)
- **Entry point**: `src/main.ts`
- **Output**: `main.js` (CommonJS format, ES2018 target)
- **External modules**: obsidian, electron, @codemirror/*, @lezer/*

### Testing in Obsidian
1. Build the plugin: `npm run build`
2. Copy `main.js` and `manifest.json` to `.obsidian/plugins/obsidian-send-to-x4/`
3. Enable the plugin in Obsidian settings

### TypeScript Configuration
- Strict null checks enabled
- No implicit any
- ES6 target with ESNext modules
- Source maps inline for development

## Key Conventions

### Code Style
- JSDoc comments for public methods
- Console logging with `[Send to X4]`, `[QueueManager]`, `[X4 Upload]`, `[CrossPoint Upload]` prefixes
- Error handling: catch errors, log them, show user-friendly Notice

### Obsidian API Usage
- Use `requestUrl` for HTTP requests (works around CORS)
- Use `Notice` for user feedback
- Use `MarkdownRenderer.render()` for Markdown conversion
- File operations via `app.vault` and `app.fileManager`

### EPUB Generation
- EPUB 2.0 format for maximum e-reader compatibility
- UTF-8 encoding throughout
- XML escaping via `EpubTemplates.escapeXml()`
- Self-closing tags converted for XHTML compliance

### Upload Protocol
Both uploaders use multipart/form-data for file uploads:
- Generate unique boundary
- Build multipart body with proper headers
- Handle folder creation before upload

## Important Files

| File | Purpose |
|------|---------|
| `manifest.json` | Obsidian plugin manifest (id, version, minAppVersion) |
| `package.json` | npm dependencies, build scripts |
| `tsconfig.json` | TypeScript compiler options |
| `esbuild.config.mjs` | Build configuration |

## Dependencies

- **jszip**: EPUB file generation (ZIP with specific structure)
- **obsidian**: Obsidian API types and runtime
- **typescript**: Development only
- **esbuild**: Bundler

## Device Communication

### X4 Standard Firmware API
```
Base URL: http://192.168.3.3

GET /list?dir=/                    # List directory
PUT /edit (multipart: name="path") # Create folder
POST /edit (multipart: name="data", filename="path") # Upload file
```

### CrossPoint Firmware API
```
Base URL: http://192.168.4.1

GET /api/files?path=/              # List directory
POST /mkdir (multipart: name, path) # Create folder
POST /upload?path=/folder          # Upload file
```

## Common Tasks for AI Assistants

### Adding a new setting
1. Add property to `SendToX4Settings` interface in `types.ts`
2. Add default value to `DEFAULT_SETTINGS` in `types.ts`
3. Add UI control in `SendToX4SettingTab.display()` in `settings.ts`

### Adding a new command
1. Add `this.addCommand({...})` in `SendToX4Plugin.onload()` in `main.ts`
2. Implement the command callback method
3. Use `checkCallback` pattern if command requires specific context (e.g., active markdown file)

### Modifying EPUB output
- Templates: `src/epub/epub-templates.ts`
- Structure/metadata: `src/epub/epub-builder.ts`
- Content conversion: `src/utils/markdown-converter.ts`

### Adding support for new firmware
1. Create new uploader class implementing `Uploader` interface
2. Add firmware toggle to settings
3. Update `QueueManager.getUploader()` to return appropriate uploader

## Watch Folder Behavior

1. Files placed in watch folder (default: `obsidian-to-x4/`) are auto-queued
2. Plugin scans watch folder on startup for existing files
3. Auto-upload triggers every 30 seconds if device connected
4. Successfully uploaded files move to `{watchFolder}/Sent/` subfolder
5. Files already in Sent subfolder are ignored
