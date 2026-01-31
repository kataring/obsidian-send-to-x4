/**
 * X4 Upload via Obsidian requestUrl
 * Uses the X4's /edit endpoint directly
 *
 * API endpoints:
 * - GET /list?dir=/ - List directory contents
 * - PUT /edit with name="path" - Create folder
 * - POST /edit with name="data" - Upload file
 */

import { requestUrl, RequestUrlParam } from 'obsidian';
import { UploadResult, FileItem } from '../types';
import { Uploader } from './uploader-interface';

export class X4Uploader implements Uploader {
    private baseUrl: string;
    private uploadEndpoint: string;
    private listEndpoint: string;

    constructor(ip: string = '192.168.3.3') {
        this.baseUrl = `http://${ip}`;
        this.uploadEndpoint = `${this.baseUrl}/edit`;
        this.listEndpoint = `${this.baseUrl}/list`;
    }

    /**
     * Check if X4 is reachable
     */
    async isConnected(): Promise<boolean> {
        try {
            const response = await requestUrl({
                url: `${this.listEndpoint}?dir=/`,
                method: 'GET',
                throw: false
            });
            return response.status >= 200 && response.status < 300;
        } catch {
            return false;
        }
    }

    /**
     * List directory contents on X4
     * X4 API returns: { type: 'dir'|'file', name: string }[]
     */
    async listDirectory(path: string): Promise<FileItem[] | null> {
        try {
            const response = await requestUrl({
                url: `${this.listEndpoint}?dir=${encodeURIComponent(path)}`,
                method: 'GET',
                throw: false
            });

            if (response.status < 200 || response.status >= 300) {
                console.error('[X4] Failed to list directory:', response.status);
                return null;
            }

            const items = response.json as Array<{ type: string; name: string; size?: number }>;
            return items.map(item => ({
                name: item.name,
                isDirectory: item.type === 'dir',
                size: item.size
            }));
        } catch (error) {
            console.error('[X4] Error listing directory:', error);
            return null;
        }
    }

    /**
     * Upload EPUB to X4 via Obsidian requestUrl
     */
    async uploadEpub(epubData: ArrayBuffer, filename: string, targetFolder: string): Promise<UploadResult> {
        console.log('[X4 Upload] Starting upload for:', filename);
        console.log('[X4 Upload] File size:', epubData.byteLength, 'bytes');

        try {
            // Step 1: Ensure target folder exists
            const folderReady = await this.ensureFolderExists(targetFolder);
            if (!folderReady) {
                console.warn('[X4 Upload] Could not verify/create folder, uploading to root instead');
            }

            // Step 2: Determine upload path
            const uploadPath = folderReady
                ? `/${targetFolder}/${filename}`
                : `/${filename}`;

            console.log('[X4 Upload] Upload path:', uploadPath);

            // Step 3: Upload the file
            return await this.uploadFile(epubData, uploadPath);

        } catch (error) {
            console.error('[X4 Upload] Error:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Check if folder exists and create if not (supports nested folders)
     */
    private async ensureFolderExists(folderPath: string): Promise<boolean> {
        try {
            console.log('[X4 Upload] Checking if folder exists:', folderPath);

            // Normalize path: remove leading/trailing slashes and split into segments
            const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');
            if (!normalizedPath) {
                return true; // Root folder always exists
            }

            const segments = normalizedPath.split('/').filter(s => s.length > 0);
            console.log('[X4 Upload] Folder segments:', segments);

            // Create each folder level if it doesn't exist
            let currentPath = '';
            for (const segment of segments) {
                const parentPath = currentPath || '/';
                const exists = await this.folderExistsAt(segment, parentPath);

                if (!exists) {
                    console.log('[X4 Upload] Creating folder:', segment, 'at', parentPath);
                    const created = await this.createFolder(segment, parentPath);
                    if (!created) {
                        console.error('[X4 Upload] Failed to create folder:', segment);
                        return false;
                    }
                }

                currentPath = currentPath ? `${currentPath}/${segment}` : `/${segment}`;
            }

            console.log('[X4 Upload] All folders ready');
            return true;

        } catch (error) {
            console.error('[X4 Upload] Error checking/creating folder:', error);
            return false;
        }
    }

    /**
     * Check if folder exists at a specific parent path using /list endpoint
     */
    private async folderExistsAt(folderName: string, parentPath: string): Promise<boolean> {
        try {
            const response = await requestUrl({
                url: `${this.listEndpoint}?dir=${encodeURIComponent(parentPath)}`,
                method: 'GET'
            });

            const items = response.json as Array<{ type: string; name: string }>;
            console.log('[X4 Upload] Directory contents at', parentPath, ':', items);

            const folder = items.find(item =>
                item.type === 'dir' && item.name === folderName
            );

            return !!folder;

        } catch (error) {
            console.error('[X4 Upload] Error listing directory:', error);
            return false;
        }
    }

    /**
     * Create a folder using PUT /edit with multipart form data
     * @param folderName - Name of the folder to create
     * @param parentPath - Parent directory path (e.g., "/" for root)
     */
    async createFolder(folderName: string, parentPath: string = '/'): Promise<boolean> {
        try {
            // Build full path: /parentPath/folderName/
            let fullPath: string;
            if (parentPath === '/' || parentPath === '') {
                fullPath = `/${folderName}/`;
            } else {
                const cleanParent = parentPath.startsWith('/') ? parentPath : '/' + parentPath;
                const normalizedParent = cleanParent.endsWith('/') ? cleanParent : cleanParent + '/';
                fullPath = `${normalizedParent}${folderName}/`;
            }

            console.log('[X4 Upload] Creating folder at path:', fullPath);

            const boundary = this.generateBoundary();
            const body = this.buildFolderCreateBody(fullPath, boundary);

            const response = await requestUrl({
                url: this.uploadEndpoint,
                method: 'PUT',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body
            });

            console.log('[X4 Upload] Create folder response:', response.status);

            if (response.status >= 200 && response.status < 300) {
                console.log('[X4 Upload] Folder created successfully');
                return true;
            } else {
                console.error('[X4 Upload] Failed to create folder');
                return false;
            }

        } catch (error) {
            console.error('[X4 Upload] Error creating folder:', error);
            return false;
        }
    }

    /**
     * Upload file to specified path using multipart form data
     */
    private async uploadFile(data: ArrayBuffer, path: string): Promise<UploadResult> {
        try {
            const boundary = this.generateBoundary();
            const body = this.buildMultipartBody(data, path, boundary);

            console.log('[X4 Upload] Sending POST to', this.uploadEndpoint);

            const response = await requestUrl({
                url: this.uploadEndpoint,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body
            });

            console.log('[X4 Upload] Response status:', response.status);

            if (response.status >= 200 && response.status < 300) {
                console.log('[X4 Upload] Success!');
                return { success: true };
            } else {
                return {
                    success: false,
                    error: `Upload failed with status ${response.status}`
                };
            }

        } catch (error) {
            console.error('[X4 Upload] Fetch error:', error);
            const errorMessage = (error as Error).message;

            if (errorMessage.includes('net::ERR') || errorMessage.includes('Failed to fetch')) {
                return {
                    success: false,
                    error: 'Cannot reach X4. Make sure you are on X4 WiFi.'
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
            `Content-Disposition: form-data; name="data"; filename="${filename}"\r\n` +
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
     * Build multipart body for folder creation
     */
    private buildFolderCreateBody(path: string, boundary: string): ArrayBuffer {
        const encoder = new TextEncoder();
        const body = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="path"\r\n\r\n` +
            `${path}\r\n` +
            `--${boundary}--\r\n`;

        return encoder.encode(body).buffer;
    }

    /**
     * Delete a file or folder on X4
     * Uses DELETE /edit with path parameter
     */
    async deleteItem(path: string): Promise<boolean> {
        try {
            const boundary = this.generateBoundary();
            const body = this.buildDeleteBody(path, boundary);

            const response = await requestUrl({
                url: this.uploadEndpoint,
                method: 'DELETE',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body,
                throw: false
            });

            console.log('[X4] Delete response:', response.status);
            return response.status >= 200 && response.status < 300;
        } catch (error) {
            console.error('[X4] Error deleting item:', error);
            return false;
        }
    }

    /**
     * Build multipart body for delete operation
     */
    private buildDeleteBody(path: string, boundary: string): ArrayBuffer {
        const encoder = new TextEncoder();
        const body = `--${boundary}\r\n` +
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
