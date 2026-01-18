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

  // Clone the request so we can try multiple parsing methods
  const clonedRequest = request.clone();

  // FIRST: Try the native formData() API
  console.log('[Avatar Upload] Attempting native formData() parsing...');
  try {
    const formData = await request.formData();
    const file = formData.get('avatar');
    
    if (file && file instanceof File) {
      console.log('[Avatar Upload] Native formData() worked! File:', file.name, file.size, 'bytes', file.type);
      const arrayBuffer = await file.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
      };
    } else {
      console.log('[Avatar Upload] Native formData() returned no file. Keys:', [...formData.keys()]);
    }
  } catch (nativeError) {
    console.log('[Avatar Upload] Native formData() failed:', nativeError instanceof Error ? nativeError.message : nativeError);
  }

  // FALLBACK: Try reading raw body and parsing with busboy
  console.log('[Avatar Upload] Trying fallback: raw body + busboy...');
  
  const bodyBuffer = await clonedRequest.arrayBuffer();
  const nodeBuffer = Buffer.from(bodyBuffer);
  console.log('[Avatar Upload] Body read, size:', bodyBuffer.byteLength, 'bytes');
  console.log('[Avatar Upload] Body hex (first 50 bytes):', nodeBuffer.slice(0, 50).toString('hex'));
  
  if (bodyBuffer.byteLength === 0) {
    console.error('[Avatar Upload] Body is empty!');
    return null;
  }

  // Check if body starts with boundary (should start with 0x2d2d = "--")
  const startsWithDash = nodeBuffer[0] === 0x2d && nodeBuffer[1] === 0x2d;
  console.log('[Avatar Upload] Starts with "--":', startsWithDash);

  // Check for common image signatures (in case it's raw image data)
  const isPNG = nodeBuffer[0] === 0x89 && nodeBuffer[1] === 0x50 && nodeBuffer[2] === 0x4e && nodeBuffer[3] === 0x47;
  const isJPEG = nodeBuffer[0] === 0xff && nodeBuffer[1] === 0xd8;
  const isGIF = nodeBuffer[0] === 0x47 && nodeBuffer[1] === 0x49 && nodeBuffer[2] === 0x46;
  const isWEBP = nodeBuffer[0] === 0x52 && nodeBuffer[1] === 0x49 && nodeBuffer[2] === 0x46 && nodeBuffer[3] === 0x46;
  
  if (isPNG || isJPEG || isGIF || isWEBP) {
    const mimeType = isPNG ? 'image/png' : isJPEG ? 'image/jpeg' : isGIF ? 'image/gif' : 'image/webp';
    console.log('[Avatar Upload] Detected raw image data:', mimeType);
    return {
      buffer: nodeBuffer,
      filename: `avatar.${isPNG ? 'png' : isJPEG ? 'jpg' : isGIF ? 'gif' : 'webp'}`,
      mimeType,
    };
  }

  // If it looks like multipart, try busboy
  if (startsWithDash) {
    return new Promise((resolve, reject) => {
      const bb = busboy({ 
        headers: { 'content-type': contentType },
        limits: { fileSize: MAX_FILE_SIZE }
      });
      
      let fileData: ParsedFile | null = null;
      let filePromise: Promise<void> | null = null;

      bb.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;
        console.log('[Avatar Upload] Busboy file:', { fieldname, filename, mimeType });
        
        if (fieldname !== 'avatar') {
          file.resume();
          return;
        }

        const chunks: Buffer[] = [];
        filePromise = new Promise<void>((fileResolve, fileReject) => {
          file.on('data', (chunk: Buffer) => chunks.push(chunk));
          file.on('end', () => {
            fileData = { buffer: Buffer.concat(chunks), filename, mimeType };
            console.log('[Avatar Upload] File received:', fileData.buffer.length, 'bytes');
            fileResolve();
          });
          file.on('error', fileReject);
        });
      });

      bb.on('close', async () => {
        if (filePromise) await filePromise;
        resolve(fileData);
      });

      bb.on('error', reject);
      bb.write(nodeBuffer);
      bb.end();
    });
  }

  console.log('[Avatar Upload] Body format not recognized. Cannot parse.');
  return null;
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
