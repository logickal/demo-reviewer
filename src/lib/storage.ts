import { Storage } from '@google-cloud/storage';

export interface FileItem {
    name: string;
    type: 'file' | 'directory';
}

export interface StorageProvider {
    listFiles(path: string): Promise<FileItem[]>;
    getFile(path: string): Promise<any>;
    saveFile(path: string, data: any): Promise<void>;
    getFileMetadata(path: string): Promise<{ updated: Date } | null>;
    getAudioStream(path: string): Promise<ReadableStream | NodeJS.ReadableStream>;
    getAudioUrl?(path: string): Promise<string>;
}

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'my-bucket';

export class GoogleCloudStorageProvider implements StorageProvider {
    private storage: Storage;
    private bucketName: string;

    constructor() {
        const credentialsJson = process.env.GCS_CREDENTIALS_JSON;
        const envKeys = Object.keys(process.env).filter(key => key.startsWith('GCS_') || key.startsWith('NEXT_'));
        const options: any = {};

        if (credentialsJson) {
            try {
                options.credentials = JSON.parse(credentialsJson);
            } catch (error) {
                console.error('Failed to parse GCS_CREDENTIALS_JSON', error);
            }
        }

        this.storage = new Storage(options);
        this.bucketName = BUCKET_NAME;
    }

    async listFiles(pathStr: string): Promise<FileItem[]> {
        const prefix = pathStr ? (pathStr.endsWith('/') ? pathStr : `${pathStr}/`) : '';

        // If we are at root, we might want to list top-level folders?
        // Or if pathStr is "folder1", we list contents of "folder1/"

        // GCS is flat, but we simulate directories with delimiter '/'
        const options = {
            prefix: prefix,
            delimiter: '/',
            autoPaginate: false // Just get the first page of results typically sufficient for a file browser
        };

        const [files, nextQuery, apiResponse] = await this.storage.bucket(this.bucketName).getFiles(options) as [any[], any, any]; // Casting to any to avoid type complexity with GCS response for now

        // apiResponse.prefixes contains the "directories"
        const directories: FileItem[] = (apiResponse.prefixes || []).map((prefix: string) => {
            // prefix is "folder1/" or "parent/folder1/"
            // We want just the name relative to the current path
            const relativeName = prefix.slice(0, -1).split('/').pop() || prefix;
            return { name: relativeName, type: 'directory' };
        });

        const fileItems: FileItem[] = files.map(file => {
            const name = file.name.split('/').pop() || file.name;
            // Filter out the directory placeholder itself if it exists (e.g. "folder1/")
            if (file.name === prefix) return null;
            return { name: name, type: 'file' };
        }).filter((item): item is FileItem => item !== null);

        return [...directories, ...fileItems];
    }

    async getFile(path: string): Promise<any> {
        try {
            const [content] = await this.storage.bucket(this.bucketName).file(path).download();
            return JSON.parse(content.toString());
        } catch (error: any) {
            if (error.code === 404) {
                return null;
            }
            throw error;
        }
    }

    async saveFile(path: string, data: any): Promise<void> {
        await this.storage.bucket(this.bucketName).file(path).save(JSON.stringify(data, null, 2));
    }

    async getFileMetadata(path: string): Promise<{ updated: Date } | null> {
        try {
            const [metadata] = await this.storage.bucket(this.bucketName).file(path).getMetadata();
            if (!metadata.updated) {
                return null;
            }
            return { updated: new Date(metadata.updated) };
        } catch (error: any) {
            if (error.code === 404) {
                return null;
            }
            throw error;
        }
    }

    async getAudioStream(path: string): Promise<NodeJS.ReadableStream> {
        const file = this.storage.bucket(this.bucketName).file(path);
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error(`File not found: ${path}`);
        }
        return file.createReadStream();
    }
}

// Singleton instance
export const storage = new GoogleCloudStorageProvider();
