# Send to X4

An Obsidian plugin that converts Markdown notes to EPUB format and sends them to Xtenik X4 e-ink devices via WiFi.

## Features

- **Markdown to EPUB Conversion** - Automatically convert Obsidian notes to e-book format
- **WiFi Upload** - Send directly to X4 devices over the network
- **Watch Folder** - Automatically detect and send files from a designated folder
- **Auto Upload** - Automatically upload queued items when device is connected
- **Manual EPUB Download** - Download EPUB files without uploading to device
- **Multiple Firmware Support** - Compatible with both standard X4 firmware and CrossPoint custom firmware

## Installation

1. Open Obsidian Settings > Community Plugins > Browse
2. Search for "Send to X4" and install
3. Enable the plugin

### Manual Installation

1. Download the latest release from this repository
2. Copy `main.js`, `manifest.json`, and `styles.css` to your Obsidian plugins folder (`.obsidian/plugins/obsidian-send-to-x4/`)
3. Restart Obsidian and enable the plugin

## Usage

### Manual Send

1. Open the note you want to send
2. Send using any of these methods:
   - Run "Send current note to X4" from the command palette
   - Select "Send to X4" from the file menu
   - Select "Send to X4" from the right-click context menu
   - Click the ribbon icon in the sidebar

### Using Watch Folder

1. Create an `obsidian-to-x4` folder in your vault (or specify a custom name in settings)
2. Place Markdown files you want to send in that folder
3. Files will be automatically sent when the device is connected via WiFi
4. After successful upload, files are moved to a "Sent" subfolder

### EPUB Download

To download an EPUB file without uploading to X4:
1. Open the note
2. Run "Download current note as EPUB" from the command palette

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

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Use CrossPoint Firmware | Use CrossPoint firmware instead of standard | OFF |
| Target Folder | Upload destination folder on X4 | `obsidian-to-x4` |
| Enable Watch Folder | Enable watch folder feature | ON |
| Watch Folder Path | Path to watch folder in vault | `obsidian-to-x4` |
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
