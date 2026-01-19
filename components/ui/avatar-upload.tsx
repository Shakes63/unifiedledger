'use client';

import { useState, useRef } from 'react';
import { UserAvatar } from './user-avatar';
import { Button } from './button';
import { validateImageFile } from '@/lib/avatar-client-utils';
import { toast } from 'sonner';
import { Upload, Trash2, Loader2 } from 'lucide-react';

export interface AvatarUploadProps {
  /** Current user ID */
  userId: string;
  /** Current user name */
  userName: string;
  /** Current avatar URL */
  avatarUrl?: string | null;
  /** Callback when avatar is updated */
  onAvatarUpdate?: (newAvatarUrl: string | null) => void;
}

/**
 * AvatarUpload component - Allows users to upload, preview, and remove avatars
 *
 * Features:
 * - File picker with validation
 * - Image preview before upload
 * - Upload progress indicator
 * - Remove avatar functionality
 * - Success/error notifications
 * - Fully themed with CSS variables
 */
export function AvatarUpload({
  userId,
  userName,
  avatarUrl,
  onAvatarUpdate,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    handleUpload(file);
  };

  // Resize image on client side to avoid large upload corruption
  const resizeImage = (file: File, maxSize: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 JPEG at 85% quality
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);

    // Retry logic for network corruption issues
    // The Docker/Unraid network sometimes corrupts request bodies
    const maxRetries = 5; // Increased retries since corruption is common
    let lastError: Error | null = null;
    let base64: string;

    try {
      // Resize image on client to reduce payload size
      // This reduces a 3MB photo to ~100-200KB
      base64 = await resizeImage(file, 800);
      console.log(`[Avatar Upload] Resized image size: ${Math.round(base64.length / 1024)}KB`);
    } catch (resizeError) {
      console.error('Failed to resize image:', resizeError);
      toast.error('Failed to process image');
      setIsUploading(false);
      return;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Avatar Upload] Attempt ${attempt}/${maxRetries}...`);
        
        const response = await fetch('/api/profile/avatar/upload', {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: base64,
            filename: file.name.replace(/\.[^.]+$/, '.jpg'), // Always jpg after resize
            mimeType: 'image/jpeg', // We convert to JPEG during resize
          }),
        });

        // Check response
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMsg = errorData.error || `Status ${response.status}`;
          
          // 400/500 errors might be from network corruption - retry
          if ((response.status === 400 || response.status === 500) && attempt < maxRetries) {
            console.log(`[Avatar Upload] Attempt ${attempt} failed (${errorMsg}), retrying in ${attempt}s...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Longer delay
            continue;
          }
          throw new Error(errorMsg);
        }

        // Success!
        const data = await response.json();
        console.log(`[Avatar Upload] Success on attempt ${attempt}!`);
        
        // Notify parent component
        if (onAvatarUpdate) {
          onAvatarUpdate(data.avatarUrl);
        }

        toast.success('Avatar updated successfully!');
        setPreviewUrl(null);
        setIsUploading(false);

        // Small delay before refresh to ensure toast is visible
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.reload();
        return; // Success - exit the retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Upload failed');
        console.error(`[Avatar Upload] Attempt ${attempt} error:`, error);
        
        if (attempt >= maxRetries) {
          break;
        }
        
        // Longer delay for network issues
        console.log(`[Avatar Upload] Waiting ${attempt}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    // All retries failed
    toast.error(lastError?.message || 'Failed to upload avatar');
    setPreviewUrl(null);
    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!avatarUrl) return;

    setIsRemoving(true);

    try {
      const response = await fetch('/api/profile/avatar', { credentials: 'include', method: 'DELETE', });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Removal failed');
      }

      toast.success('Avatar removed successfully!');

      // Notify parent component
      if (onAvatarUpdate) {
        onAvatarUpdate(null);
      }

      // Refresh the page to update avatar everywhere
      window.location.reload();
    } catch (error) {
      console.error('Remove error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove avatar');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-card border border-border rounded-lg">
      {/* Avatar Display */}
      <div className="relative">
        {previewUrl ? (
          <div className="w-30 h-30 rounded-full overflow-hidden border-2 border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <UserAvatar
            userId={userId}
            userName={userName}
            avatarUrl={avatarUrl}
            size="xl"
            showRing={false}
          />
        )}

        {/* Loading overlay */}
        {(isUploading || isRemoving) && (
          <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Upload Instructions */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Upload a profile picture (max 5MB)
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, or WebP format
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleButtonClick}
          disabled={isUploading || isRemoving}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          {avatarUrl ? 'Change Photo' : 'Upload Photo'}
        </Button>

        {avatarUrl && (
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isUploading || isRemoving}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload avatar image"
      />

      {/* Upload status */}
      {isUploading && (
        <p className="text-sm text-muted-foreground">
          Uploading and optimizing image...
        </p>
      )}
      {isRemoving && (
        <p className="text-sm text-muted-foreground">
          Removing avatar...
        </p>
      )}
    </div>
  );
}
