'use client';

import { useState, useRef } from 'react';
import NextImage from 'next/image';
import { Button } from './button';
import { toast } from 'sonner';
import { Upload, Trash2, Loader2 } from 'lucide-react';

export interface AvatarUploadProps {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  onAvatarUpdate?: (newAvatarUrl: string | null) => void;
}

// Size for avatar display
const AVATAR_SIZE = 150; // pixels

/**
 * Resize image to a small square for avatar use
 * Returns a data URL (e.g., "data:image/jpeg;base64,...")
 */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Create square crop from center
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw cropped and resized image
      ctx.drawImage(img, x, y, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

      // Convert to JPEG data URL (good compression)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate consistent color from userId
 */
function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}

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

  const displayUrl = previewUrl || avatarUrl;
  const initials = getInitials(userName);
  const bgColor = getAvatarColor(userId);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (10MB max for original)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setIsUploading(true);

    try {
      // Resize to small data URL
      const dataUrl = await resizeImage(file);
      setPreviewUrl(dataUrl);

      // Upload to server
      const response = await fetch('/api/profile/avatar/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      toast.success('Avatar updated!');
      onAvatarUpdate?.(data.avatarUrl);
      
      // Refresh to show new avatar everywhere
      window.location.reload();
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!avatarUrl) return;

    setIsRemoving(true);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove');
      }

      toast.success('Avatar removed!');
      setPreviewUrl(null);
      onAvatarUpdate?.(null);
      
      window.location.reload();
    } catch (error) {
      console.error('Avatar remove error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar Display */}
      <div className="relative w-24 h-24">
        {displayUrl ? (
          <NextImage
            src={displayUrl}
            alt={`${userName}'s avatar`}
            fill
            unoptimized
            sizes="96px"
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
        )}

        {/* Loading overlay */}
        {(isUploading || isRemoving) && (
          <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Instructions */}
      <p className="text-sm text-muted-foreground text-center">
        Upload a profile picture (JPG, PNG, WebP)
      </p>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isRemoving}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          {avatarUrl ? 'Change' : 'Upload'}
        </Button>

        {avatarUrl && (
          <Button
            variant="outline"
            onClick={handleRemove}
            disabled={isUploading || isRemoving}
            className="gap-2 text-error hover:text-error"
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
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
