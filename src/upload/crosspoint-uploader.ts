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
import { UploadResult, FileItem } from '../types';
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
     * List directory contents on CrossPoint device
     * CrossPoint API returns: { isDirectory: boolean, name: string }[]
     */
    async listDirectory(path: string): Promise<FileItem[] | null> {
        try {
            const response = await requestUrl({
                url: `${this.listEndpoint}?path=${encodeURIComponent(path)}`,
                method: 'GET',
                throw: false
            });

            if (response.status < 200 || response.status >= 300) {
                console.error('[CrossPoint] Failed to list directory:', response.status);
                return null;
            }

            const items = response.json as Array<{ isDirectory: boolean; name: string; size?: number }>;
            return items.map(item => ({
                name: item.name,
                isDirectory: item.isDirectory,
                size: item.size
            }));
        } catch (error) {
            console.error('[CrossPoint] Error listing directory:', error);
            return null;
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
     * Check if folder exists and create if not (supports nested folders)
     */
    private async ensureFolderExists(folderPath: string): Promise<boolean> {
        try {
            console.log('[CrossPoint Upload] Checking if folder exists:', folderPath);

            // Normalize path: remove leading/trailing slashes and split into segments
            const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');
            if (!normalizedPath) {
                return true; // Root folder always exists
            }

            const segments = normalizedPath.split('/').filter(s => s.length > 0);
            console.log('[CrossPoint Upload] Folder segments:', segments);

            // Create each folder level if it doesn't exist
            let currentPath = '/';
            for (const segment of segments) {
                const exists = await this.folderExistsAt(segment, currentPath);

                if (!exists) {
                    console.log('[CrossPoint Upload] Creating folder:', segment, 'at', currentPath);
                    const created = await this.createFolder(segment, currentPath);
                    if (!created) {
                        console.error('[CrossPoint Upload] Failed to create folder:', segment);
                        return false;
                    }
                }

                currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`;
            }

            console.log('[CrossPoint Upload] All folders ready');
            return true;

        } catch (error) {
            console.error('[CrossPoint Upload] Error checking/creating folder:', error);
            return false;
        }
    }

    /**
     * Check if folder exists at a specific parent path using GET /api/files endpoint
     */
    private async folderExistsAt(folderName: string, parentPath: string): Promise<boolean> {
        try {
            const response = await requestUrl({
                url: `${this.listEndpoint}?path=${encodeURIComponent(parentPath)}`,
                method: 'GET'
            });

            const items = response.json as Array<{ isDirectory: boolean; name: string }>;
            console.log('[CrossPoint Upload] Directory contents at', parentPath, ':', items);

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
     * @param folderName - Name of the folder to create
     * @param parentPath - Parent directory path (e.g., "/" for root)
     */
    async createFolder(folderName: string, parentPath: string = '/'): Promise<boolean> {
        try {
            const boundary = this.generateBoundary();
            const body = this.buildMkdirBody(folderName, parentPath, boundary);

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
     * Delete a file or folder on CrossPoint device
     * Uses POST /delete endpoint
     */
    async deleteItem(path: string): Promise<boolean> {
        try {
            const boundary = this.generateBoundary();
            const body = this.buildDeleteBody(path, boundary);

            const response = await requestUrl({
                url: `${this.baseUrl}/delete`,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body,
                throw: false
            });

            console.log('[CrossPoint] Delete response:', response.status);
            return response.status >= 200 && response.status < 300;
        } catch (error) {
            console.error('[CrossPoint] Error deleting item:', error);
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

    /**
     * Download a file from CrossPoint device
     * Uses GET request to /download endpoint
     */
    async downloadFile(path: string): Promise<ArrayBuffer | null> {
        try {
            const url = `${this.baseUrl}/download?path=${encodeURIComponent(path)}`;
            console.log('[CrossPoint] Downloading file from:', url);

            const response = await requestUrl({
                url: url,
                method: 'GET',
                throw: false
            });

            if (response.status >= 200 && response.status < 300) {
                return response.arrayBuffer;
            }
            console.error('[CrossPoint] Failed to download file:', response.status);
            return null;
        } catch (error) {
            console.error('[CrossPoint] Error downloading file:', error);
            return null;
        }
    }

    /**
     * Move/rename a file or folder on CrossPoint
     * CrossPoint doesn't have a native move API, so we download, upload to new location, then delete original
     */
    async moveItem(sourcePath: string, destPath: string): Promise<boolean> {
        try {
            console.log('[CrossPoint] Moving item from', sourcePath, 'to', destPath);

            // Download the file
            const data = await this.downloadFile(sourcePath);
            if (!data) {
                console.error('[CrossPoint] Failed to download source file');
                return false;
            }

            // Extract filename from destPath
            const filename = destPath.split('/').pop() || 'file';
            const targetDir = destPath.substring(0, destPath.lastIndexOf('/')) || '/';

            // Upload to new location
            const uploadSuccess = await this.uploadRawFile(data, filename, targetDir);
            if (!uploadSuccess) {
                console.error('[CrossPoint] Failed to upload to destination');
                return false;
            }

            // Delete original
            const deleteSuccess = await this.deleteItem(sourcePath);
            if (!deleteSuccess) {
                console.warn('[CrossPoint] Failed to delete original file (file was copied but original remains)');
            }

            return true;
        } catch (error) {
            console.error('[CrossPoint] Error moving item:', error);
            return false;
        }
    }

    /**
     * Upload a raw file (not EPUB conversion) to CrossPoint
     */
    async uploadRawFile(data: ArrayBuffer, filename: string, targetPath: string): Promise<boolean> {
        try {
            const boundary = this.generateBoundary();
            const body = this.buildMultipartBody(data, filename, boundary);

            // Normalize path
            let uploadPath: string;
            if (targetPath === '/' || targetPath === '') {
                uploadPath = '/';
            } else {
                uploadPath = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
            }

            const uploadUrl = `${this.uploadEndpoint}?path=${encodeURIComponent(uploadPath)}`;
            console.log('[CrossPoint] Uploading raw file to:', uploadUrl);

            const response = await requestUrl({
                url: uploadUrl,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: body,
                throw: false
            });

            return response.status >= 200 && response.status < 300;
        } catch (error) {
            console.error('[CrossPoint] Error uploading raw file:', error);
            return false;
        }
    }
}
