import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import mime from 'mime-types';

export interface FileInfo {
  id: string;
  filename: string;
  storedFilename: string;
  size: number;
  mimeType: string;
  uploadDate: number;
  lastDownload: number;
  downloadCount: number;
  userId: string;
}

interface StorageData {
  files: { [id: string]: FileInfo };
}

/**
 * Класс для управления хранилищем файлов
 */
export class FileStorage {
  private uploadDir: string;
  private metadataFile: string;
  private data: StorageData;
  private readonly expirationDays = 30;

  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;
    this.metadataFile = path.join(uploadDir, 'metadata.json');
    this.data = this.loadMetadata();
  }

  /**
   * Загрузка метаданных из файла
   */
  private loadMetadata(): StorageData {
    if (fs.existsSync(this.metadataFile)) {
      try {
        const content = fs.readFileSync(this.metadataFile, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error loading metadata:', error);
      }
    }
    return { files: {} };
  }

  /**
   * Сохранение метаданных в файл
   */
  private saveMetadata(): void {
    try {
      fs.writeFileSync(this.metadataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  }

  /**
   * Генерация уникального ID для файла
   */
  private generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Сохранение файла
   */
  async saveFile(filename: string, data: Buffer, userId: string): Promise<FileInfo> {
    const fileId = this.generateFileId();
    const ext = path.extname(filename);
    const storedFilename = `${fileId}${ext}`;
    const filePath = path.join(this.uploadDir, storedFilename);

    // Сохраняем файл
    fs.writeFileSync(filePath, data);

    // Создаем метаданные
    const fileInfo: FileInfo = {
      id: fileId,
      filename,
      storedFilename,
      size: data.length,
      mimeType: mime.lookup(filename) || 'application/octet-stream',
      uploadDate: Date.now(),
      lastDownload: Date.now(),
      downloadCount: 0,
      userId,
    };

    this.data.files[fileId] = fileInfo;
    this.saveMetadata();

    return fileInfo;
  }

  /**
   * Получение информации о файле
   */
  getFileInfo(fileId: string): FileInfo | null {
    return this.data.files[fileId] || null;
  }

  /**
   * Обновление времени последнего скачивания
   */
  updateLastDownload(fileId: string): void {
    const fileInfo = this.data.files[fileId];
    if (fileInfo) {
      fileInfo.lastDownload = Date.now();
      fileInfo.downloadCount++;
      this.saveMetadata();
    }
  }

  /**
   * Получение файлов пользователя
   */
  getUserFiles(userId: string): FileInfo[] {
    return Object.values(this.data.files).filter(file => file.userId === userId);
  }

  /**
   * Очистка устаревших файлов
   */
  cleanupOldFiles(): number {
    const now = Date.now();
    const expirationTime = this.expirationDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const [fileId, fileInfo] of Object.entries(this.data.files)) {
      if (now - fileInfo.lastDownload > expirationTime) {
        const filePath = path.join(this.uploadDir, fileInfo.storedFilename);
        
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          delete this.data.files[fileId];
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting file ${fileId}:`, error);
        }
      }
    }

    if (deletedCount > 0) {
      this.saveMetadata();
    }

    return deletedCount;
  }

  /**
   * Получение статистики
   */
  getStatistics(): any {
    const files = Object.values(this.data.files);
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalDownloads = files.reduce((sum, file) => sum + file.downloadCount, 0);

    return {
      totalFiles: files.length,
      totalSize,
      totalDownloads,
      files: files.map(f => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        uploadDate: f.uploadDate,
        lastDownload: f.lastDownload,
        downloadCount: f.downloadCount,
      })),
    };
  }
}


