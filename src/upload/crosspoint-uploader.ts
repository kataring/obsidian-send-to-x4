/**
 * CrossPoint Firmware Upload API
 * Uses the CrossPoint firmware endpoints via Obsidian requestUrl
 *
 * API endpoints:
 * - POST /upload?path=/ - Upload file via multipart form data
 * - GET /api/files?path=/ - List directory contents
 * - POST /mkdir - Create folder
 */

import { requestUrl } from 'obsidian';
import { UploadResult } from '../types';
import { Uploader } from './uploader-interface';

export class CrossPointUploader implements Uploader {
    private baseUrl: string;
    private uploadEndpoint: string;
    private listEndpoint: string;
    private mkdirEndpoint: string;

    constructor(ip: string = '192.168.4.1') {
        this.baseUrl = `http://${ip}`;
        this.uploadEndpoint = `${this.baseUrl}/upload`;
        this.listEndpoint = `${this.baseUrl}/api/files`;
        this.mkdirEndpoint = `${this.baseUrl}/mkdir`;
    }

    /**
     * Check if CrossPoint device is reachable
     */
    async isConnected(): Promise<boolean> {
        try {
            const response = await requestUrl({
                url: `${this.listEndpoint}?path=/`,
                method: 'GET',
                throw: false
            });
            return response.status >= 200 && response.status < 300;
        } catch {
            return false;
        }
    }

    /**
     * Upload EPUB to CrossPoint device
     */
    async uploadEpub(epubData: ArrayBuffer, filename: string, targetFolder: string): Promise<UploadResult> {
        console.log('[CrossPoint Upload] Starting upload for:', filename);
        console.log('[CrossPoint Upload] File size:', epubData.byteLength, 'bytes');

        try {
            // Step 1: Ensure target folder exists
            const folderReady = await this.ensureFolderExists(targetFolder);
            if (!folderReady) {
                console.warn('[CrossPoint Upload] Could not verify/create folder, uploading to root instead');
            }

            // Step 2: Determine upload path
            const uploadPath = folderReady ? `/${targetFolder}` : `/`;

            console.log('[CrossPoint Upload] Upload path:', uploadPath);

            // Step 3: Upload the file
            return await this.uploadFile(epubData, filename, uploadPath);

        } catch (error) {
            console.error('[CrossPoint Upload] Error:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Check if folder exists and create if not
     */
    private async ensureFolderExists(folderName: string): Promise<boolean> {
        try {
            console.log('[CrossPoint Upload] Checking if folder exists:', folderName);
            const exists = await this.folderExists(folderName);

            if (exists) {
                console.log('[CrossPoint Upload] Folder already exists');
                return true;
            }

            console.log('[CrossPoint Upload] Creating folder:', folderName);
            return await this.createFolder(folderName);

        } catch (error) {
            console.error('[CrossPoint Upload] Error checking/creating folder:', error);
            return false;
        }
    }

    /**
     * Check if folder exists using GET /api/files endpoint
     */
    private async folderExists(folderName: string): Promise<boolean> {
        try {
            const response = await requestUrl({
                url: `${this.listEndpoint}?path=/`,
                method: 'GET'
            });

            const items = response.json as Array<{ isDirectory: boolean; name: string }>;
            console.log('[CrossPoint Upload] Root directory contents:', items);

            const folder = items.find(item =>
                item.isDirectory && item.name === folderName
            );

            return !!folder;

        } catch (error) {
            console.error('[CrossPoint Upload] Error listing directory:', error);
            return false;
        }
    }

    /**
     * Create a folder using POST /mkdir with multipart form data
     */
    private async createFolder(folderName: string): Promise<boolean> {
        try {
            const boundary = this.generateBoundary();
            const body = this.buildMkdirBody(folderName, '/', boundary);

            const response = await requestUrl({
                url: this.mkdirEndpoint,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body
            });

            console.log('[CrossPoint Upload] Create folder response:', response.status);

            if (response.status >= 200 && response.status < 300) {
                console.log('[CrossPoint Upload] Folder created successfully');
                return true;
            } else {
                console.error('[CrossPoint Upload] Failed to create folder');
                return false;
            }

        } catch (error) {
            console.error('[CrossPoint Upload] Error creating folder:', error);
            return false;
        }
    }

    /**
     * Upload file to specified path
     */
    private async uploadFile(data: ArrayBuffer, filename: string, path: string): Promise<UploadResult> {
        try {
            const boundary = this.generateBoundary();
            const body = this.buildMultipartBody(data, filename, boundary);

            const uploadUrl = `${this.uploadEndpoint}?path=${encodeURIComponent(path)}`;

            console.log('[CrossPoint Upload] Sending POST to', uploadUrl);

            const response = await requestUrl({
                url: uploadUrl,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body
            });

            console.log('[CrossPoint Upload] Response status:', response.status);

            if (response.status >= 200 && response.status < 300) {
                console.log('[CrossPoint Upload] Success!');
                return { success: true };
            } else {
                return {
                    success: false,
                    error: `Upload failed with status ${response.status}`
                };
            }

        } catch (error) {
            console.error('[CrossPoint Upload] Fetch error:', error);
            const errorMessage = (error as Error).message;

            if (errorMessage.includes('net::ERR') || errorMessage.includes('Failed to fetch')) {
                return {
                    success: false,
                    error: 'Cannot reach CrossPoint device. Make sure you are on CrossPoint WiFi.'
                };
            }

            return { success: false, error: errorMessage };
        }
    }

    /**
     * Build multipart body for file upload
     */
    private buildMultipartBody(data: ArrayBuffer, filename: string, boundary: string): ArrayBuffer {
        const encoder = new TextEncoder();
        const header = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
            `Content-Type: application/epub+zip\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;

        const headerBytes = encoder.encode(header);
        const footerBytes = encoder.encode(footer);

        const combined = new Uint8Array(headerBytes.length + data.byteLength + footerBytes.length);
        combined.set(headerBytes, 0);
        combined.set(new Uint8Array(data), headerBytes.length);
        combined.set(footerBytes, headerBytes.length + data.byteLength);

        return combined.buffer;
    }

    /**
     * Build multipart body for mkdir
     */
    private buildMkdirBody(name: string, path: string, boundary: string): ArrayBuffer {
        const encoder = new TextEncoder();
        const body = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="name"\r\n\r\n` +
            `${name}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="path"\r\n\r\n` +
            `${path}\r\n` +
            `--${boundary}--\r\n`;

        return encoder.encode(body).buffer;
    }

    /**
     * Generate a unique boundary for multipart form data
     */
    private generateBoundary(): string {
        return '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    }
}
