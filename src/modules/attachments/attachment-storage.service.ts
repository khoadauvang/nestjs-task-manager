import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import type { Env } from '../../config/env.schema.js';

/**
 * Stores files on the local disk as <UPLOAD_DIR>/<projectId>/<taskId>/<uuid><ext>.
 * File names are generated here, so user input never becomes part of a path.
 * Swapping this class for an S3 implementation would not change the callers.
 */
@Injectable()
export class AttachmentStorage {
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  async save(
    projectId: string,
    taskId: string,
    content: Buffer,
    extension: string,
  ): Promise<string> {
    const key = `${projectId}/${taskId}/${randomUUID()}${extension}`;
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { flag: 'wx' });
    return key;
  }

  async openReadStream(key: string): Promise<ReadStream> {
    const path = this.resolveKey(key);
    try {
      await stat(path);
    } catch {
      throw new NotFoundException('File not found');
    }
    return createReadStream(path);
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async removeTaskFiles(projectId: string, taskId: string): Promise<void> {
    await rm(this.resolveKey(`${projectId}/${taskId}`), {
      recursive: true,
      force: true,
    });
  }

  async removeProjectFiles(projectId: string): Promise<void> {
    await rm(this.resolveKey(projectId), { recursive: true, force: true });
  }

  /** Defense in depth: refuses any key that would point outside UPLOAD_DIR. */
  private resolveKey(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return path;
  }
}
