# Send to X4

An Obsidian plugin that converts Markdown notes to EPUB format and sends them to Xtenik X4 e-ink devices via WiFi.

## Features

- **Markdown to EPUB Conversion** - Automatically convert Obsidian notes to EPUB 2.0 format
- **WiFi Upload** - Send directly to X4 devices over the network
- **Manual EPUB Download** - Download EPUB files without uploading to device
- **Multiple Firmware Support** - Compatible with both standard X4 firmware and CrossPoint custom firmware
- **X4 File Browser** - Browse, manage, and organize files on your X4 device from within Obsidian
- **Folder Management** - Create folders and upload files to specific directories on X4

## Installation

1. Open Obsidian Settings > Community Plugins > Browse
2. Search for "Send to X4" and install
3. Enable the plugin

### Manual Installation

1. Download the latest release from this repository
2. Copy `main.js`, `manifest.json`, and `styles.css` to your Obsidian plugins folder (`.obsidian/plugins/obsidian-send-to-x4/`)
3. Restart Obsidian and enable the plugin

## Usage

### Send Note to X4

1. Open the X4 file browser:
   - Click the hard drive icon in the ribbon (sidebar)
   - Or run "Open X4 file browser" from the command palette
2. Navigate to the folder you want to upload to
3. Right-click the folder and select "Upload to this folder"
4. Select the notes you want to send

### EPUB Download

To download an EPUB file without uploading to X4:
1. Open the note
2. Run "Download current note as EPUB" from the command palette

### X4 File Browser

Browse and manage files on your X4 device directly from Obsidian:

1. Open the file browser:
   - Click the hard drive icon in the ribbon (sidebar)
   - Or run "Open X4 file browser" from the command palette
2. Click "Refresh" to connect to your X4 device
3. Browse folders by clicking to expand/collapse

**File Browser Features:**
- **Create Folder** - Click the folder+ icon or right-click a folder
- **Upload to Folder** - Right-click a folder and select "Upload to this folder"
- **Delete Files** - Right-click a file or folder to delete
- **Bulk Delete** - Click the checkbox icon to enter selection mode, select multiple items, then delete

## Metadata

You can specify metadata using YAML frontmatter:

```yaml
---
title: "Article Title"
author: "@username"
date: 2025-01-31
---
```

This metadata is used for the EPUB filename and internal metadata.

## Commands

| Command | Description |
|---------|-------------|
| Download current note as EPUB | Download the current note as an EPUB file |
| Open X4 file browser | Open the X4 device file browser in the sidebar |

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Use CrossPoint Firmware | Use CrossPoint firmware instead of standard | OFF |
| X4 IP Address | IP address for standard X4 firmware | `192.168.3.3` |
| CrossPoint IP Address | IP address for CrossPoint firmware | `192.168.4.1` |

## Supported Devices

- Xtenik X4 (standard firmware)
- Devices with CrossPoint custom firmware

## Technical Specifications

- **EPUB Format**: EPUB 2.0
- **Minimum Obsidian Version**: 0.15.0
- **Network**: WiFi (HTTP)

## Development

### Build

```bash
npm install
npm run build
```

### Development Mode

```bash
npm run dev
```

## License

MIT License

## Contributing

Bug reports and feature requests are welcome on [Issues](https://github.com/kataring/obsidian-send-to-x4/issues).
