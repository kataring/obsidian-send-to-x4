/**
 * Settings tab for Send to X4 plugin
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import SendToX4Plugin from './main';

export class SendToX4SettingTab extends PluginSettingTab {
    plugin: SendToX4Plugin;

    constructor(app: App, plugin: SendToX4Plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Send to X4 Settings' });

        new Setting(containerEl)
            .setName('Use CrossPoint Firmware')
            .setDesc('Enable if your X4 is running CrossPoint firmware instead of the standard firmware')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useCrosspointFirmware)
                .onChange(async (value) => {
                    this.plugin.settings.useCrosspointFirmware = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Target Folder')
            .setDesc('Folder name on the X4 device to upload EPUBs to')
            .addText(text => text
                .setPlaceholder('send-to-x4')
                .setValue(this.plugin.settings.targetFolder)
                .onChange(async (value) => {
                    this.plugin.settings.targetFolder = value || 'send-to-x4';
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Network Settings' });

        new Setting(containerEl)
            .setName('X4 IP Address')
            .setDesc('IP address for standard X4 firmware (default: 192.168.3.3)')
            .addText(text => text
                .setPlaceholder('192.168.3.3')
                .setValue(this.plugin.settings.x4Ip)
                .onChange(async (value) => {
                    this.plugin.settings.x4Ip = value || '192.168.3.3';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('CrossPoint IP Address')
            .setDesc('IP address for CrossPoint firmware (default: 192.168.4.1)')
            .addText(text => text
                .setPlaceholder('192.168.4.1')
                .setValue(this.plugin.settings.crosspointIp)
                .onChange(async (value) => {
                    this.plugin.settings.crosspointIp = value || '192.168.4.1';
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Queue' });

        const queueItems = this.plugin.queueManager.getQueue();
        const pendingCount = queueItems.filter(i => i.status === 'pending').length;
        const doneCount = queueItems.filter(i => i.status === 'done').length;

        new Setting(containerEl)
            .setName('Queue Status')
            .setDesc(`${queueItems.length} items total (${pendingCount} pending, ${doneCount} completed)`)
            .addButton(button => button
                .setButtonText('Clear Completed')
                .onClick(() => {
                    this.plugin.queueManager.clearCompleted();
                    this.display();
                }))
            .addButton(button => button
                .setButtonText('Clear All')
                .setWarning()
                .onClick(() => {
                    this.plugin.queueManager.clearAll();
                    this.display();
                }));
    }
}
