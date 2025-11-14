# Avatar Upload Implementation Plan

## Feature Overview
Implement a complete profile picture/avatar upload system with the following capabilities:
- Upload custom avatar images
- Generate default avatars from user initials
- Display avatars throughout the app (navigation, settings, activity feed, household members)
- Image optimization and validation
- Secure file storage

## Technical Architecture

### Storage Strategy
**Decision:** Local filesystem storage (aligns with self-hosting goals)
- Store in `public/uploads/avatars/` directory
- Filename format: `{userId}.{extension}` (e.g., `abc123.jpg`)
- Public URL: `/uploads/avatars/{userId}.{extension}`
- File types: `.jpg`, `.jpeg`, `.png`, `.webp`
- Max file size: 5MB
- Auto-resize to 400x400px (high quality), generate 200x200px and 80x80px thumbnails

### Database Schema Changes
Add avatar fields to `users` table:
```sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at INTEGER;
```

### Components to Create/Update

#### New Components
1. **`components/ui/avatar-upload.tsx`**
   - Drag-and-drop file upload
   - Preview before upload
   - Crop/zoom interface (optional for MVP)
   - Progress indicator
   - Error handling
   - Uses shadcn/ui Dialog and Button

2. **`components/ui/user-avatar.tsx`**
   - Display avatar or initials fallback
   - Multiple sizes: sm (32px), md (40px), lg (80px), xl (120px)
   - Ring border with theme color
   - Loading state
   - Error fallback to initials

3. **`lib/avatar-utils.ts`**
   - Generate initials from name
   - Generate deterministic background colors from user ID
   - Validate image files
   - Image optimization utilities

#### Components to Update
1. **`components/navigation/sidebar.tsx`**
   - Replace user icon with UserAvatar component
   - Show avatar in user profile section

2. **`components/navigation/mobile-nav.tsx`**
   - Replace user icon with UserAvatar component
   - Show avatar in mobile header

3. **`app/dashboard/settings/components/profile-tab.tsx`**
   - Add AvatarUpload component
   - Show current avatar with edit button
   - Add remove avatar option

4. **`components/activity/activity-feed-item.tsx`**
   - Show user avatars in activity feed
   - Different sizes based on context

5. **`app/dashboard/household/page.tsx`**
   - Show avatars for household members
   - Avatar in member list

### API Routes to Create

#### 1. `app/api/profile/avatar/upload/route.ts`
**POST** - Upload new avatar
- Accept multipart/form-data
- Validate file type and size
- Optimize/resize image using sharp
- Save to public/uploads/avatars/
- Update users table with avatar_url
- Return new avatar URL
- Error handling for invalid files, storage errors

#### 2. `app/api/profile/avatar/route.ts`
**DELETE** - Remove avatar
- Delete file from filesystem
- Set avatar_url to null in database
- Return success status

**GET** - Get current avatar URL
- Return avatar_url for authenticated user

### Implementation Steps

#### Phase 1: Database & Utilities (Day 1)
1. ✅ Create database migration for avatar fields
   - Add `avatar_url` and `avatar_updated_at` to users table
   - Run migration: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`

2. ✅ Install dependencies
   - `sharp` for image processing
   - `@types/sharp` for TypeScript

3. ✅ Create `lib/avatar-utils.ts`
   - `getInitials(name: string): string` - Extract up to 2 initials
   - `getAvatarColor(userId: string): string` - Generate deterministic color
   - `validateImageFile(file: File): { valid: boolean; error?: string }`
   - `optimizeImage(buffer: Buffer): Promise<Buffer>` - Resize to 400x400
   - Image validation constants (ALLOWED_TYPES, MAX_FILE_SIZE)

#### Phase 2: Avatar Display Component (Day 1-2)
4. ✅ Create `components/ui/user-avatar.tsx`
   - Props: `userId`, `userName`, `avatarUrl?`, `size?`, `className?`
   - Render avatar image if avatarUrl exists
   - Render initials fallback with deterministic background color
   - Support sizes: 'sm' (32px), 'md' (40px), 'lg' (80px), 'xl' (120px)
   - Add theme-aware ring border: `ring-2 ring-[var(--color-border)]`
   - Loading skeleton state
   - Error state falls back to initials

5. ✅ Test UserAvatar component in isolation
   - With avatar URL
   - Without avatar URL (initials)
   - Different sizes
   - Different theme colors

#### Phase 3: File Upload API (Day 2)
6. ✅ Create upload directory structure
   - Ensure `public/uploads/avatars/` exists
   - Add to .gitignore if needed

7. ✅ Create `app/api/profile/avatar/upload/route.ts`
   ```typescript
   - Authenticate user
   - Parse multipart/form-data
   - Validate file type (jpg, jpeg, png, webp)
   - Validate file size (max 5MB)
   - Delete old avatar if exists
   - Optimize image with sharp (400x400, quality 90)
   - Save as {userId}.{extension}
   - Update database: users.avatar_url = `/uploads/avatars/{userId}.{ext}`
   - Return { success: true, avatarUrl: string }
   ```

8. ✅ Create `app/api/profile/avatar/route.ts`
   - DELETE: Remove avatar file and set avatar_url to null
   - GET: Return current user's avatar_url

9. ✅ Test API endpoints
   - Upload valid image
   - Upload invalid file type
   - Upload oversized file
   - Delete avatar
   - Error handling

#### Phase 4: Upload UI Component (Day 3)
10. ✅ Create `components/ui/avatar-upload.tsx`
    - Show current avatar with UserAvatar component
    - "Change Photo" button opens file picker
    - Drag and drop support
    - Preview selected image before upload
    - Upload progress indicator
    - Success/error toast notifications
    - "Remove Photo" button (only if avatar exists)
    - Uses shadcn/ui Button, Dialog
    - All colors use theme variables

11. ✅ Integrate AvatarUpload in Profile tab
    - Add to `app/dashboard/settings/components/profile-tab.tsx`
    - Position at top of form
    - Centered layout
    - Handle upload success → update UI immediately

#### Phase 5: Integration Throughout App (Day 3-4)
12. ✅ Update Sidebar Navigation
    - Import UserAvatar in `components/navigation/sidebar.tsx`
    - Replace UserCircle icon with UserAvatar component
    - Size: 'md' (40px)
    - Add hover effect

13. ✅ Update Mobile Navigation
    - Import UserAvatar in `components/navigation/mobile-nav.tsx`
    - Replace UserCircle icon with UserAvatar component
    - Size: 'sm' (32px)

14. ✅ Update Activity Feed
    - Import UserAvatar in `components/activity/activity-feed-item.tsx`
    - Show avatar for each activity item
    - Size: 'sm' (32px)
    - Fetch user data with avatar_url

15. ✅ Update Household Members
    - Show avatars in household member list
    - Update API to include avatar_url in member queries
    - Size: 'md' (40px)

16. ✅ Update Settings Profile Preview
    - Show large avatar in settings preview
    - Size: 'xl' (120px)

#### Phase 6: Polish & Testing (Day 4-5)
17. ✅ Add loading states
    - Skeleton loader while avatar uploads
    - Optimistic UI updates

18. ✅ Error handling
    - Network errors
    - File validation errors
    - Storage errors
    - User-friendly error messages

19. ✅ Accessibility
    - Alt text for images
    - ARIA labels for upload buttons
    - Keyboard navigation
    - Screen reader announcements

20. ✅ Performance optimization
    - Lazy load avatars in lists
    - Cache avatar URLs
    - Compress images with sharp

21. ✅ Edge cases
    - User with no name (use email)
    - Very long names (truncate initials)
    - Special characters in names
    - Concurrent uploads (prevent)
    - File system permissions

22. ✅ Documentation
    - Update CLAUDE.md with avatar feature
    - Add comments to avatar utilities
    - API endpoint documentation

## UI/UX Design Specifications

### Avatar Display
- **Border Radius:** `rounded-full` (fully circular)
- **Ring:** `ring-2 ring-[var(--color-border)]` on hover
- **Background (initials):** Use deterministic color from predefined palette
  - Colors: blue, green, purple, pink, orange, teal, indigo
  - Based on userId hash for consistency
- **Text (initials):**
  - Color: `text-white` (high contrast)
  - Font: Inter Bold
  - Size: Based on avatar size (sm: 14px, md: 16px, lg: 24px, xl: 36px)

### Upload Interface
- **Layout:** Centered card in Profile tab
- **Background:** `bg-card` with `border border-border`
- **Spacing:** `p-6` padding, `gap-4` between elements
- **Current Avatar:** Large (120px) at top
- **Buttons:**
  - Primary: `bg-[var(--color-primary)]` for "Change Photo"
  - Destructive: `bg-[var(--color-error)]` for "Remove Photo"
  - Text: `text-foreground`
- **Drag Area:** Dashed border `border-2 border-dashed border-border`
- **Preview:** Show selected image before upload with Cancel/Confirm buttons
- **Progress:** Linear progress bar with `bg-[var(--color-primary)]`

### Responsive Behavior
- Desktop: Full upload interface with drag-and-drop
- Mobile: Simple file picker button (no drag-and-drop)
- Tablet: Full interface, optimized touch targets

### Theming Integration
All components must use semantic theme variables:
- `bg-background`, `bg-card`, `bg-elevated`
- `text-foreground`, `text-muted-foreground`
- `border-border`
- `bg-[var(--color-primary)]` for primary actions
- `bg-[var(--color-error)]` for destructive actions
- `bg-[var(--color-success)]` for success states

### Fallback Colors for Initials
Deterministic palette based on userId:
```typescript
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];
```

## Testing Strategy

### Unit Tests
- `lib/avatar-utils.ts`
  - getInitials() with various name formats
  - getAvatarColor() consistency
  - validateImageFile() with different file types
  - optimizeImage() output quality

### Integration Tests
- Upload API endpoint
  - Successful upload
  - Invalid file type rejection
  - File size limit enforcement
  - Concurrent upload handling
- Delete API endpoint
  - Successful deletion
  - File cleanup verification

### Manual Testing
- Upload various image formats (jpg, png, webp)
- Upload oversized image
- Upload invalid file type
- Delete avatar
- Verify avatars appear in all locations:
  - Sidebar
  - Mobile nav
  - Settings page
  - Activity feed
  - Household members
- Test across all 7 themes
- Test responsive layouts (mobile, tablet, desktop)
- Test accessibility with screen reader

## Dependencies to Install
```bash
pnpm add sharp
pnpm add -D @types/sharp
```

## Files to Create
1. `lib/db/migrations/0030_add_avatar_fields.sql`
2. `lib/avatar-utils.ts`
3. `components/ui/user-avatar.tsx`
4. `components/ui/avatar-upload.tsx`
5. `app/api/profile/avatar/upload/route.ts`
6. `app/api/profile/avatar/route.ts`

## Files to Modify
1. `lib/db/schema.ts` - Add avatar fields to users table type
2. `components/navigation/sidebar.tsx`
3. `components/navigation/mobile-nav.tsx`
4. `app/dashboard/settings/components/profile-tab.tsx`
5. `components/activity/activity-feed-item.tsx`
6. `app/dashboard/household/page.tsx`
7. `.gitignore` - Add `/public/uploads/` if not already ignored

## Success Criteria
- ✅ Users can upload avatar images through Settings > Profile
- ✅ Images are validated, optimized, and stored securely
- ✅ Avatars display throughout the app (navigation, settings, activity, household)
- ✅ Initials fallback works for users without avatars
- ✅ All components use semantic theme variables
- ✅ Responsive design works on mobile, tablet, desktop
- ✅ Accessibility standards met (alt text, ARIA labels, keyboard nav)
- ✅ Error handling provides clear user feedback
- ✅ No console errors or warnings

## Estimated Timeline
- **Phase 1-2:** 1-2 days (database, utilities, display component)
- **Phase 3:** 0.5-1 day (API endpoints)
- **Phase 4:** 0.5-1 day (upload UI)
- **Phase 5:** 1-2 days (integration throughout app)
- **Phase 6:** 1 day (polish, testing, documentation)

**Total:** 4-7 days depending on complexity and testing thoroughness

## Notes
- This feature aligns with self-hosting goals (local file storage)
- Future enhancement: Add image cropping interface (use react-easy-crop)
- Future enhancement: Support for gravatar integration
- Future enhancement: Avatar history/rollback
- Consider adding avatar to household invitation emails
- Consider adding avatar to export data (JSON/CSV)
