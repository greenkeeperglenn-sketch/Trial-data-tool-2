# Supabase Storage Setup for Plot Images

The Imagery Analyzer feature requires a Supabase Storage bucket to store extracted plot images.

## Setup Instructions

### 1. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure the bucket:
   - **Name:** `plot-images`
   - **Public bucket:** ✅ **YES** (check this box)
   - **File size limit:** 10 MB (recommended)
   - **Allowed MIME types:** Leave default or specify `image/jpeg, image/jpg, image/png`

### 2. Set Bucket Policies (Required for Public Access)

After creating the bucket, you need to set up policies so users can upload and view images:

1. In the Storage section, click on the `plot-images` bucket
2. Go to **Policies** tab
3. Create the following policies:

#### Policy 1: Allow Authenticated Uploads
```sql
-- Name: Allow authenticated users to upload plot images
-- Allowed operation: INSERT
-- Target roles: authenticated

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plot-images');
```

#### Policy 2: Allow Public Read Access
```sql
-- Name: Allow public read access to plot images
-- Allowed operation: SELECT
-- Target roles: public

CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'plot-images');
```

#### Policy 3: Allow Authenticated Updates
```sql
-- Name: Allow authenticated users to update their plot images
-- Allowed operation: UPDATE
-- Target roles: authenticated

CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'plot-images')
WITH CHECK (bucket_id = 'plot-images');
```

#### Policy 4: Allow Authenticated Deletes
```sql
-- Name: Allow authenticated users to delete their plot images
-- Allowed operation: DELETE
-- Target roles: authenticated

CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plot-images');
```

### 3. Verify Setup

After setup, you should be able to:
- ✅ Upload images from the Imagery Analyzer
- ✅ View images in Presentation Mode
- ✅ See images in Analysis views

### Troubleshooting

**Images not uploading?**
- Check browser console for error messages
- Verify bucket name is exactly `plot-images`
- Ensure bucket is marked as **public**
- Check that all policies are created

**Images not displaying?**
- Verify the bucket is public
- Check the SELECT policy exists
- Try opening the image URL directly in a new tab

**Permission errors?**
- Make sure you're logged in (authenticated)
- Verify the INSERT policy exists for authenticated users
- Check Supabase project URL and anon key in `.env`

### Image Organization

Images are stored with this structure:
```
plot-images/
  └── {trialId}/
      └── {date}/
          └── {plotId}.jpg
```

Example:
```
plot-images/
  └── 550e8400-e29b-41d4-a716-446655440000/
      └── 2024-03-15/
          └── A1.jpg
          └── A2.jpg
          └── B1.jpg
```

This organization makes it easy to:
- Find all images for a specific trial
- Filter images by date
- Identify individual plot images
