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

    /**
     * Delete a file or folder on the device
     * @param path - Path to delete
     * @returns true if successful
     */
    deleteItem(path: string): Promise<boolean>;

    /**
     * Create a folder on the device
     * @param folderName - Name of the folder to create
     * @param parentPath - Parent directory path (e.g., "/" for root)
     * @returns true if successful
     */
    createFolder(folderName: string, parentPath: string): Promise<boolean>;

    /**
     * Download a file from the device
     * @param path - Path of the file to download
     * @returns File data as ArrayBuffer or null if failed
     */
    downloadFile(path: string): Promise<ArrayBuffer | null>;

    /**
     * Move/rename a file or folder on the device
     * @param sourcePath - Current path of the item
     * @param destPath - Destination path
     * @returns true if successful
     */
    moveItem(sourcePath: string, destPath: string): Promise<boolean>;

    /**
     * Upload a raw file (not EPUB conversion)
     * @param data - File data as ArrayBuffer
     * @param filename - Filename to use
     * @param targetPath - Target folder path
     * @returns true if successful
     */
    uploadRawFile(data: ArrayBuffer, filename: string, targetPath: string): Promise<boolean>;
}
