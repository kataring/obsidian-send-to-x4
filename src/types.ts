/**
 * Type definitions for Send to X4 plugin
 */

export interface SendToX4Settings {
    useCrosspointFirmware: boolean;
    targetFolder: string;
    x4Ip: string;
    crosspointIp: string;
    watchFolderEnabled: boolean;
    watchFolder: string;
}

export const DEFAULT_SETTINGS: SendToX4Settings = {
    useCrosspointFirmware: false,
    targetFolder: 'send-to-x4',
    x4Ip: '192.168.3.3',
    crosspointIp: '192.168.4.1',
    watchFolderEnabled: false,
    watchFolder: 'send-to-x4',
};

export interface ArticleData {
    title: string;
    author: string;
    date: string;
    body: string;
    url?: string;
}

export interface QueueItem {
    id: string;
    title: string;
    filePath: string;
    status: 'pending' | 'uploading' | 'done' | 'failed';
    error?: string;
}

export interface UploadResult {
    success: boolean;
    error?: string;
}

export interface EpubMetadata {
    title: string;
    author: string;
    date: string;
    uuid: string;
}
