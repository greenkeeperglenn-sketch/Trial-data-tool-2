# Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in:
   - **Project Name**: `trial-data-tool` (or your preference)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
4. Click "Create new project" (takes ~2 minutes to provision)

## Step 2: Get Your API Credentials

1. In your Supabase project dashboard, click on the ⚙️ **Settings** icon (bottom left)
2. Go to **API** section
3. You'll need two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (the `anon` `public` key, not the `service_role` key)

## Step 3: Create Environment File

Create a `.env` file in your project root with these values:

```bash
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: Replace `your_project_url_here` and `your_anon_key_here` with your actual values from Step 2.

## Step 4: Run Database Migration

1. In your Supabase project dashboard, click on the **SQL Editor** icon (left sidebar)
2. Click "New query"
3. Copy the entire contents of `supabase-migration.sql` from your project
4. Paste into the SQL editor
5. Click "Run" to execute

This will create:
- `trials` table for storing all trial data
- Row Level Security (RLS) policies for user data isolation
- Indexes for performance

## Step 5: Set Up Storage for Photos

Photos are stored in Supabase Storage for reliable persistence. Run this SQL in the SQL Editor:

```sql
-- Create the storage bucket for plot images
INSERT INTO storage.buckets (id, name, public)
VALUES ('plot-images', 'plot-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload photos
CREATE POLICY "Users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plot-images');

-- Create policy to allow public read access to photos
CREATE POLICY "Photos are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'plot-images');

-- Create policy to allow users to update their photos
CREATE POLICY "Users can update photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'plot-images');

-- Create policy to allow users to delete their photos
CREATE POLICY "Users can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plot-images');
```

**Important**: Without this storage bucket, photos will not persist between sessions!

## Step 6: Enable Authentication (Optional but Recommended)

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Enable **Email** provider (it's enabled by default)
3. Configure email templates if desired (Settings > Auth > Email Templates)

## Security Notes

- The `.env` file is already in `.gitignore` - never commit API keys to Git
- The `anon` key is safe to use in client-side code
- Row Level Security ensures users can only access their own data
- For production, consider enabling additional providers (Google, GitHub, etc.)

## Verification

After setup, you can verify the connection by:
1. Starting your app: `npm run dev`
2. The app should automatically connect to Supabase
3. Create a new trial - it should be saved to the database
4. Check the Supabase dashboard under **Table Editor** > **trials** to see your data

## Troubleshooting

**Connection errors?**
- Verify your `.env` file exists in the project root
- Check that environment variables match exactly (including `VITE_` prefix)
- Restart your dev server after creating/modifying `.env`

**RLS policy errors?**
- Make sure you're logged in (authentication required)
- Check that Row Level Security is enabled on the `trials` table

**Need help?**
- Supabase docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
