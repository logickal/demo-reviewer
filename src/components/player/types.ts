export interface FileItem {
  name: string;
  type: 'file' | 'directory';
}

export interface Comment {
  id: string;
  timestamp?: number;
  text: string;
  initials: string;
  parentId?: string;
  createdAt?: string;
}
