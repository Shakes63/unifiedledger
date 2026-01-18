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
import busboy from 'busboy';
import { inflateSync } from 'zlib';

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

  // First, read ALL body data into a buffer
  const bodyBuffer = await request.arrayBuffer();
  const nodeBuffer = Buffer.from(bodyBuffer);
  console.log('[Avatar Upload] Body read, size:', bodyBuffer.byteLength, 'bytes');
  
  // Log first 100 bytes as hex to see actual content
  const hexPreview = nodeBuffer.slice(0, 100).toString('hex');
  console.log('[Avatar Upload] Body hex (first 100 bytes):', hexPreview);
  
  // Check if body is zlib compressed (starts with 0x78)
  // Cloudflare or other proxies might compress the request body
  let actualBuffer = nodeBuffer;
  if (nodeBuffer[0] === 0x78) {
    console.log('[Avatar Upload] Detected possible zlib compression, attempting to decompress...');
    try {
      actualBuffer = inflateSync(nodeBuffer);
      console.log('[Avatar Upload] Decompressed successfully! New size:', actualBuffer.length, 'bytes');
      console.log('[Avatar Upload] Decompressed hex (first 100 bytes):', actualBuffer.slice(0, 100).toString('hex'));
    } catch (zlibError) {
      console.log('[Avatar Upload] Zlib decompression failed (might not be compressed):', zlibError instanceof Error ? zlibError.message : zlibError);
    }
  }
  
  // Check if body starts with boundary (should start with 0x2d2d = "--")
  const startsWithDash = actualBuffer[0] === 0x2d && actualBuffer[1] === 0x2d;
  console.log('[Avatar Upload] Starts with "--":', startsWithDash);
  
  if (actualBuffer.byteLength === 0) {
    console.error('[Avatar Upload] Body is empty!');
    return null;
  }

  // If body doesn't look like multipart, it might be raw file data
  // Try to detect if it's an image directly
  if (!startsWithDash) {
    console.log('[Avatar Upload] Body does not look like multipart data!');
    console.log('[Avatar Upload] First 4 bytes:', actualBuffer.slice(0, 4).toString('hex'));
    
    // Check for common image signatures
    const isPNG = actualBuffer[0] === 0x89 && actualBuffer[1] === 0x50 && actualBuffer[2] === 0x4e && actualBuffer[3] === 0x47;
    const isJPEG = actualBuffer[0] === 0xff && actualBuffer[1] === 0xd8;
    const isGIF = actualBuffer[0] === 0x47 && actualBuffer[1] === 0x49 && actualBuffer[2] === 0x46;
    const isWEBP = actualBuffer[0] === 0x52 && actualBuffer[1] === 0x49 && actualBuffer[2] === 0x46 && actualBuffer[3] === 0x46;
    
    console.log('[Avatar Upload] Image detection:', { isPNG, isJPEG, isGIF, isWEBP });
    
    // If it's raw image data, return it directly
    if (isPNG || isJPEG || isGIF || isWEBP) {
      const mimeType = isPNG ? 'image/png' : isJPEG ? 'image/jpeg' : isGIF ? 'image/gif' : 'image/webp';
      console.log('[Avatar Upload] Detected raw image data, treating as direct upload');
      return {
        buffer: actualBuffer,
        filename: `avatar.${isPNG ? 'png' : isJPEG ? 'jpg' : isGIF ? 'gif' : 'webp'}`,
        mimeType,
      };
    }
  }

  // Standard multipart parsing with busboy
  return new Promise((resolve, reject) => {
    const bb = busboy({ 
      headers: { 'content-type': contentType },
      limits: { fileSize: MAX_FILE_SIZE }
    });
    
    let fileData: ParsedFile | null = null;
    let filePromise: Promise<void> | null = null;

    bb.on('field', (fieldname, val) => {
      console.log('[Avatar Upload] Field received:', { fieldname, valueLength: val?.length });
    });

    bb.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      console.log('[Avatar Upload] Receiving file:', { fieldname, filename, mimeType });
      
      if (fieldname !== 'avatar') {
        console.log('[Avatar Upload] Skipping non-avatar field:', fieldname);
        file.resume();
        return;
      }

      const chunks: Buffer[] = [];
      
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

    console.log('[Avatar Upload] Writing buffer to busboy...');
    bb.write(actualBuffer);
    bb.end();
  });
}

export async function POST(request: Request) {
  // Debug: Log request details BEFORE auth (to debug regardless of auth status)
  const contentType = request.headers.get('content-type');
  console.log('[Avatar Upload] Request received:', {
    method: request.method,
    contentType,
  });

  try {
    const { userId } = await requireAuth();

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
