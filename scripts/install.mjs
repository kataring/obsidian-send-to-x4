#!/usr/bin/env node
/**
 * Install plugin to Obsidian vault
 *
 * Usage:
 *   npm run install-plugin -- /path/to/vault
 *   npm run install-plugin              # Uses OBSIDIAN_VAULT env var
 */

import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';

const PLUGIN_ID = 'send-to-x4';
const FILES_TO_COPY = ['main.js', 'manifest.json', 'styles.css'];

function getVaultPath() {
    // Check command line argument
    const args = process.argv.slice(2);
    if (args.length > 0) {
        return args[0];
    }

    // Check environment variable
    if (process.env.OBSIDIAN_VAULT) {
        return process.env.OBSIDIAN_VAULT;
    }

    console.error('Error: No vault path specified.');
    console.error('');
    console.error('Usage:');
    console.error('  npm run install-plugin -- /path/to/vault');
    console.error('  OBSIDIAN_VAULT=/path/to/vault npm run install-plugin');
    console.error('');
    console.error('You can also create a .env file with:');
    console.error('  OBSIDIAN_VAULT=/path/to/your/vault');
    process.exit(1);
}

function main() {
    const vaultPath = resolve(getVaultPath());
    const pluginDir = join(vaultPath, '.obsidian', 'plugins', PLUGIN_ID);
    const srcDir = process.cwd();

    // Verify vault exists
    if (!existsSync(vaultPath)) {
        console.error(`Error: Vault path does not exist: ${vaultPath}`);
        process.exit(1);
    }

    // Verify .obsidian folder exists
    const obsidianDir = join(vaultPath, '.obsidian');
    if (!existsSync(obsidianDir)) {
        console.error(`Error: Not a valid Obsidian vault (no .obsidian folder): ${vaultPath}`);
        process.exit(1);
    }

    // Create plugins directory if needed
    const pluginsDir = join(obsidianDir, 'plugins');
    if (!existsSync(pluginsDir)) {
        mkdirSync(pluginsDir, { recursive: true });
    }

    // Create plugin directory if needed
    if (!existsSync(pluginDir)) {
        mkdirSync(pluginDir, { recursive: true });
        console.log(`Created plugin directory: ${pluginDir}`);
    }

    // Copy files
    let copied = 0;
    for (const file of FILES_TO_COPY) {
        const srcFile = join(srcDir, file);
        const destFile = join(pluginDir, file);

        if (existsSync(srcFile)) {
            copyFileSync(srcFile, destFile);
            console.log(`Copied: ${file}`);
            copied++;
        }
    }

    if (copied === 0) {
        console.error('Error: No files to copy. Did you run "npm run build" first?');
        process.exit(1);
    }

    console.log('');
    console.log(`Plugin installed to: ${pluginDir}`);
    console.log('Restart Obsidian or reload the plugin to see changes.');
}

main();
