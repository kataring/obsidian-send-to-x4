/**
 * Common interface for uploaders
 */

import { UploadResult } from '../types';

export interface Uploader {
    /**
     * Upload EPUB to the device
     * @param epubData - EPUB file as ArrayBuffer
     * @param filename - Filename to use
     * @param targetFolder - Target folder name
     * @returns Upload result
     */
    uploadEpub(epubData: ArrayBuffer, filename: string, targetFolder: string): Promise<UploadResult>;
}
