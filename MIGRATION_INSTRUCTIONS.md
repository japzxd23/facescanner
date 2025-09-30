# Scanner Settings Migration Instructions

## Overview
The scanner settings system has been implemented with proper database migration support. The settings are designed to prioritize database configuration while falling back to defaults when no custom settings exist.

## Supabase Migration

### Method 1: Using Supabase CLI (Recommended)
If you have Supabase CLI installed:

```bash
# Apply the migration
npx supabase db push

# Or apply specific migration
npx supabase migration up --target 20250925000000
```

### Method 2: Manual SQL Execution
If you prefer to apply manually, run the SQL file directly in Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/20250925000000_create_scanner_settings.sql`
4. Execute the query

## Settings Behavior

### Default Settings Priority
- **When no custom settings exist**: Uses hardcoded default settings from `DEFAULT_SCANNER_SETTINGS`
- **When custom settings exist**: Uses settings stored in database
- **When "Reset to Defaults" is used**: Deletes database record to force use of defaults

### Key Features
- **Database Storage**: Custom settings are stored in `scanner_settings` table
- **Multi-tenant**: Settings are isolated per organization
- **Caching**: 5-minute cache for performance
- **Validation**: Real-time validation with constraints
- **Import/Export**: JSON backup and restore functionality

## Database Schema

```sql
scanner_settings (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  settings JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  UNIQUE(organization_id)
)
```

## Configurable Parameters

### Face Recognition Thresholds
- `faceQualityThreshold`: 0.65 (minimum quality to process)
- `faceMatchThreshold`: 0.91 (minimum similarity for matching)
- `faceDetectionConfidence`: 0.5 (MediaPipe confidence)

### Timing & Cooldowns
- `faceProcessingCooldown`: 5000ms (prevent database flooding)
- `detectionCooldown`: 3000ms (general detection cooldown)
- `postRecognitionCooldown`: 3000ms (same person cooldown)

### Camera Settings
- `cameraResolutionWidth`: 640px
- `cameraResolutionHeight`: 480px
- `cameraFrameRate`: 60fps
- `mirrorCamera`: true

### Performance Settings
- `maxFacesDetection`: 5
- `processingQueueSize`: 1
- `scanningInterval`: 100ms

## Admin Panel Access

Navigate to: `/admin/settings`

Or use the "Scanner Settings" button in the Admin Dashboard.

## Testing Migration

1. Apply migration
2. Visit `/admin/settings`
3. Verify "Using Defaults" badge appears
4. Change a setting and save
5. Verify "Custom Settings" badge appears
6. Click "Reset to Defaults"
7. Verify "Using Defaults" badge returns

## Legacy Organization Support

A special legacy organization UUID (`00000000-0000-0000-0000-000000000001`) is created for backward compatibility with existing installations that don't use multi-tenant structure. This UUID is defined as `LEGACY_ORGANIZATION_ID` constant in the codebase.

## Troubleshooting

### Table Not Found Error
If you see "Scanner settings table not found", the migration hasn't been applied. Run:
```bash
npx supabase db push
```

### Permission Errors
Ensure your Supabase policies allow access to the scanner_settings table. The migration includes public access policies for development.

### Settings Not Loading
Check browser console for errors. The system will fall back to defaults if there are database connection issues.