import { FileStorage } from "../services/file-storage";
import {promises as fs} from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export class LocalStorage implements FileStorage {
  private async ensureUploadDirExists() {
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  async save(file: File): Promise<{ url: string; filename: string }> {
    await this.ensureUploadDirExists();
    const fileBuffer = await file.arrayBuffer();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${uniqueSuffix}-${file.name}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(filePath, Buffer.from(fileBuffer));

    const url = `/uploads/${filename}`;
    return { url, filename };
  }

  async delete(filename: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      // It's okay if the file doesn't exist
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
