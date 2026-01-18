import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import {
  optimizeImage,
} from '@/lib/avatar-utils';
import { ensureUploadsSubdir, getAvatarFilename, getAvatarUrlPath, getUploadsDir } from '@/lib/uploads/storage';
import { Readable } from 'stream';
import busboy from 'busboy';

export const dynamic = 'force-dynamic';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface ParsedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * Parse multipart form data using busboy
 * This is a workaround for Node.js undici's formData() issues
 */
async function parseMultipartForm(request: Request): Promise<ParsedFile | null> {
  const contentType = request.headers.get('content-type');
  if (!contentType) {
    throw new Error('Missing content-type header');
  }

  return new Promise((resolve, reject) => {
    const bb = busboy({ 
      headers: { 'content-type': contentType },
      limits: { fileSize: MAX_FILE_SIZE }
    });
    
    let fileData: ParsedFile | null = null;
    let filePromise: Promise<void> | null = null;

    bb.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      console.log('[Avatar Upload] Receiving file:', { fieldname, filename, mimeType });
      
      if (fieldname !== 'avatar') {
        console.log('[Avatar Upload] Skipping non-avatar field:', fieldname);
        file.resume(); // Drain the stream
        return;
      }

      const chunks: Buffer[] = [];
      
      // Create a promise that resolves when file is fully read
      filePromise = new Promise<void>((fileResolve, fileReject) => {
        file.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on('end', () => {
          fileData = {
            buffer: Buffer.concat(chunks),
            filename,
            mimeType,
          };
          console.log('[Avatar Upload] File received:', fileData.buffer.length, 'bytes');
          fileResolve();
        });

        file.on('error', (err) => {
          console.error('[Avatar Upload] File stream error:', err);
          fileReject(err);
        });
      });
    });

    bb.on('close', async () => {
      console.log('[Avatar Upload] Busboy close event, waiting for file...');
      try {
        // Wait for file to be fully processed
        if (filePromise) {
          await filePromise;
        }
        console.log('[Avatar Upload] Resolving with fileData:', fileData ? 'present' : 'null');
        resolve(fileData);
      } catch (err) {
        reject(err);
      }
    });

    bb.on('error', (err) => {
      console.error('[Avatar Upload] Busboy error:', err);
      reject(err);
    });

    // Convert Web ReadableStream to Node Readable and pipe to busboy
    const body = request.body;
    if (!body) {
      reject(new Error('Request body is null'));
      return;
    }

    const reader = body.getReader();
    const nodeStream = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        } catch (err) {
          this.destroy(err as Error);
        }
      }
    });

    nodeStream.pipe(bb);
  });
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Debug: Log request details
    const contentType = request.headers.get('content-type');
    console.log('[Avatar Upload] Request details:', {
      method: request.method,
      contentType,
      bodyUsed: request.bodyUsed,
    });

    // Verify content type is multipart/form-data
    if (!contentType?.includes('multipart/form-data')) {
      console.error('[Avatar Upload] Invalid content type:', contentType);
      return Response.json(
        { error: `Invalid content type: ${contentType}. Expected multipart/form-data` },
        { status: 400 }
      );
    }

    // Parse form data using busboy (workaround for Node.js undici issues)
    let parsedFile: ParsedFile | null;
    try {
      parsedFile = await parseMultipartForm(request);
    } catch (parseError) {
      console.error('[Avatar Upload] Form parse error:', parseError);
      return Response.json(
        { error: `Failed to parse form data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    if (!parsedFile) {
      return Response.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(parsedFile.mimeType)) {
      return Response.json(
        { error: `Invalid file type: ${parsedFile.mimeType}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (parsedFile.buffer.length > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Get current user to check for existing avatar
    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (currentUser.length === 0) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete old avatar file if it exists
    if (currentUser[0].image) {
      try {
        const oldFilename = currentUser[0].image.split('/').pop();
        if (oldFilename) {
          const uploadsOldPath = join(getUploadsDir(), 'avatars', oldFilename);
          await unlink(uploadsOldPath).catch(() => undefined);
          const legacyOldPath = join(process.cwd(), 'public', 'uploads', 'avatars', oldFilename);
          await unlink(legacyOldPath).catch(() => undefined);
        }
      } catch (error) {
        // File might not exist, ignore error
        console.log('No old avatar to delete or deletion failed:', error);
      }
    }

    // Optimize the uploaded image
    const optimizedBuffer = await optimizeImage(parsedFile.buffer);

    // We store optimized avatars as JPEG under the persisted uploads directory.
    await ensureUploadsSubdir('avatars');
    const filename = getAvatarFilename(userId);
    const avatarPath = getAvatarUrlPath(filename);
    const fullPath = join(getUploadsDir(), 'avatars', filename);

    // Save file to disk
    await writeFile(fullPath, optimizedBuffer);

    // Update database with new avatar URL and timestamp
    await db
      .update(user)
      .set({
        image: avatarPath,
        imageUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return Response.json({
      success: true,
      avatarUrl: avatarPath,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar upload error:', error);
    return Response.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}
