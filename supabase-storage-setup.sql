-- Supabase Storage Setup for Trial Photos
-- Run this in the Supabase SQL Editor after setting up the database

-- =====================================================
-- STORAGE BUCKET SETUP
-- =====================================================

-- Create the storage bucket for trial photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trial-photos',
  'trial-photos',
  true,
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Drop existing policies if they exist (for clean re-run)
DROP POLICY IF EXISTS "Users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Photos are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete photos" ON storage.objects;

-- Policy: Allow authenticated users to upload photos
CREATE POLICY "Users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trial-photos');

-- Policy: Allow public read access to all photos
CREATE POLICY "Photos are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trial-photos');

-- Policy: Allow authenticated users to update their photos
CREATE POLICY "Users can update photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'trial-photos');

-- Policy: Allow authenticated users to delete their photos
CREATE POLICY "Users can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trial-photos');

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that the bucket was created
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'trial-photos';

-- Check that policies were created
SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
