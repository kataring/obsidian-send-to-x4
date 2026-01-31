/**
 * Common interface for uploaders
 */

import { UploadResult, FileItem } from '../types';

export interface Uploader {
    /**
     * Check if the device is reachable
     * @returns true if connected
     */
    isConnected(): Promise<boolean>;

    /**
     * Upload EPUB to the device
     * @param epubData - EPUB file as ArrayBuffer
     * @param filename - Filename to use
     * @param targetFolder - Target folder name
     * @returns Upload result
     */
    uploadEpub(epubData: ArrayBuffer, filename: string, targetFolder: string): Promise<UploadResult>;

    /**
     * List directory contents on the device
     * @param path - Directory path to list (e.g., "/" for root)
     * @returns Array of file items or null if failed
     */
    listDirectory(path: string): Promise<FileItem[] | null>;
}
