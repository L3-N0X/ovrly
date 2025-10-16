import { LocalStorage } from "../lib/local-storage";

export interface FileStorage {
  save(file: File): Promise<{ url: string; filename: string }>;
  delete(filename: string): Promise<void>;
}

export const fileStorage = new LocalStorage();
