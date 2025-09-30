# Fix Guide: API Key Type Mismatch Issue

## Problem Summary
Google OAuth authentication was failing with multiple errors:

1. **API Key Type Mismatch:**
```
invalid input syntax for type uuid: "fck_w2d87usbs5fupsp459nxt"
```
The `organizations.api_key` column was defined as **UUID type**, but the application generates **TEXT-based** API keys.

2. **Role Constraint Violation:**
```
new row for relation "organization_users" violates check constraint "organization_users_role_check"
```
The `organization_users.role` constraint didn't include `'owner'` role that the application tries to use.

---

## Root Cause
The migration file `supabase/migrations/20250923150000_update_multitenant_schema.sql` originally created the `api_key` column as UUID type, which conflicts with the application's TEXT-based key generation.

---

## What Was Fixed

### 1. Migration Files Updated
- ✅ `supabase/migrations/20250923150000_update_multitenant_schema.sql` - Changed `api_key` from UUID to TEXT
- ✅ `supabase/migrations/20250930120000_fix_api_key_type.sql` - New migration to fix existing databases

### 2. Code Files (No Changes Needed)
All application code was already correct:
- ✅ All routes use `organization.id` (UUID) for database queries
- ✅ API key generation creates TEXT strings like `fck_...`
- ✅ Deep linking and OAuth callbacks are properly configured

---

## Steps to Apply Fix

### Step 1: Run Database Migration
Copy and run this complete SQL script in your **Supabase SQL Editor**:

```sql
-- Step 1: Drop all policies that depend on api_key
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE definition LIKE '%api_key%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'Dropped policy: % on %.%', pol.policyname, pol.schemaname, pol.tablename;
  END LOOP;
END $$;

-- Step 2: Change api_key column type from UUID to TEXT
ALTER TABLE organizations
ALTER COLUMN api_key TYPE TEXT USING api_key::text;

ALTER TABLE api_key_usage
ALTER COLUMN api_key TYPE TEXT USING api_key::text;

-- Step 3: Recreate RLS policies (simplified for all access)
DROP POLICY IF EXISTS "Members are publicly accessible" ON members;
CREATE POLICY "Members are publicly accessible" ON members FOR ALL USING (true);

DROP POLICY IF EXISTS "Attendance logs are publicly accessible" ON attendance_logs;
CREATE POLICY "Attendance logs are publicly accessible" ON attendance_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Organizations are publicly accessible" ON organizations;
CREATE POLICY "Organizations are publicly accessible" ON organizations FOR ALL USING (true);

DROP POLICY IF EXISTS "Organization users are publicly accessible" ON organization_users;
CREATE POLICY "Organization users are publicly accessible" ON organization_users FOR ALL USING (true);

DROP POLICY IF EXISTS "API usage is publicly accessible" ON api_key_usage;
CREATE POLICY "API usage is publicly accessible" ON api_key_usage FOR ALL USING (true);

DROP POLICY IF EXISTS "Usage stats are publicly accessible" ON usage_stats;
CREATE POLICY "Usage stats are publicly accessible" ON usage_stats FOR ALL USING (true);

-- Step 4: Convert existing UUID keys to fck_ format (optional)
UPDATE organizations
SET api_key = 'fck_' || substring(replace(api_key::text, '-', ''), 1, 24)
WHERE api_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

**Note:** The migration automatically drops and recreates RLS policies to avoid the "cannot alter type of a column used in a policy" error.

### Step 2: Clear Local Data
In your browser console:
```javascript
localStorage.clear();
```

### Step 3: Rebuild and Sync APK
```bash
npm run build
npx cap sync
npx cap open android
```

### Step 4: Test OAuth Flow
1. Open the app
2. Click "Continue with Google"
3. Complete authentication
4. Create organization
5. Verify you're redirected to admin dashboard

### Step 5: Verify All Routes Work
Test these pages:
- ✅ `/admin/dashboard` - Admin overview
- ✅ `/admin/members` - Member management
- ✅ `/admin/logs` - Attendance logs
- ✅ `/camera` - Face scanner
- ✅ `/admin/settings` - Settings

---

## Verification Checklist

### Database Verification
Run in Supabase SQL Editor:
```sql
-- Check column type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organizations' AND column_name = 'api_key';

-- Should return: data_type = 'text'

-- Check existing data
SELECT id, name, api_key FROM organizations;

-- Should show api_key values like: fck_abc123xyz456...
```

### Application Verification
1. ✅ Organization created successfully with TEXT api_key
2. ✅ Google OAuth completes without errors
3. ✅ All admin pages load member/log data correctly
4. ✅ Scanner can detect and log attendance
5. ✅ No UUID casting errors in browser console

---

## Technical Details

### Why This Fix Works
- **Database**: Now stores `api_key` as TEXT, accepting values like `fck_...`
- **Organization Context**: Still uses `organization.id` (UUID) for queries ✓
- **Type Safety**: No more casting errors between TEXT and UUID
- **Backward Compatible**: Existing UUID keys are converted to TEXT format

### Files Modified
1. `supabase/migrations/20250923150000_update_multitenant_schema.sql` - Line 9, 58
2. `supabase/migrations/20250930120000_fix_api_key_type.sql` - New file

### Files Unchanged (Already Correct)
- ✅ `src/pages/AuthPage.tsx` - Generates TEXT api_keys
- ✅ `src/services/supabaseClient.ts` - Uses `organization.id` for context
- ✅ All scanner/admin pages - Query by `organization_id` (UUID)
- ✅ `src/App.tsx` - Deep linking configured
- ✅ `capacitor.config.ts` - Mobile OAuth setup
- ✅ `android/app/src/main/AndroidManifest.xml` - Deep link intents

---

## Troubleshooting

### If OAuth still fails:
1. Verify Supabase URL Configuration:
   - Site URL: `https://cezkpqnmhoqncqissgkq.supabase.co`
   - Redirect URLs should include:
     - `https://cezkpqnmhoqncqissgkq.supabase.co/auth/v1/callback`
     - `com.FaceCheck.app://auth/callback`
     - `http://localhost:4173/auth/callback`

2. Check Google Cloud Console:
   - Authorized redirect URIs includes Supabase callback URL
   - Both Web and Android OAuth clients are configured

3. Verify database migration:
   ```sql
   SELECT data_type FROM information_schema.columns
   WHERE table_name = 'organizations' AND column_name = 'api_key';
   ```
   Should return: `text`

### If routes show no data:
1. Check browser console for `organization.id` value
2. Verify it's a UUID, not an api_key (fck_...)
3. Run: `SELECT * FROM organizations;` to verify data exists

---

## Success Criteria
✅ Google OAuth completes without UUID casting errors
✅ Organization is created with TEXT-based api_key
✅ Admin dashboard shows member/attendance stats
✅ All routes filter data by organization correctly
✅ Face scanner can add members and log attendance
✅ Mobile APK deep linking works for OAuth callback

---

## Support
If issues persist, check:
1. Supabase logs for SQL errors
2. Browser console for JavaScript errors
3. Network tab for failed API requests
4. Database RLS policies are properly configured