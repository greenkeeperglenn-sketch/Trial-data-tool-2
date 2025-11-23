import { supabase } from './supabase';

/**
 * Storage service for photo uploads
 * Uses Supabase Storage for reliable photo persistence
 */

const BUCKET_NAME = 'plot-images';

/**
 * Upload a photo to Supabase Storage
 * @param {string} trialId - Trial UUID
 * @param {string} photoKey - Photo key (e.g., "2024-01-15_plot-1")
 * @param {string} base64Data - Base64 encoded image data (data URL format)
 * @param {number} index - Photo index for multiple photos per plot/date
 * @returns {Promise<string>} Public URL of uploaded photo
 */
export const uploadPhoto = async (trialId, photoKey, base64Data, index = 0) => {
  try {
    // Extract the base64 content and content type from data URL
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data URL format');
    }

    const contentType = matches[1];
    const base64Content = matches[2];

    // Convert base64 to blob
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });

    // Determine file extension from content type
    const extension = contentType.split('/')[1] || 'jpg';

    // Create unique file path
    const fileName = `${trialId}/${photoKey}_${index}_${Date.now()}.${extension}`;

    console.log(`[Storage] Uploading photo: ${fileName}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error('[Storage] Upload error:', error);
      throw error;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    console.log(`[Storage] Photo uploaded successfully: ${urlData.publicUrl}`);

    return urlData.publicUrl;
  } catch (error) {
    console.error('[Storage] Error uploading photo:', error);
    throw error;
  }
};

/**
 * Upload multiple photos and return their URLs
 * @param {string} trialId - Trial UUID
 * @param {string} photoKey - Photo key (e.g., "2024-01-15_plot-1")
 * @param {string[]} base64DataArray - Array of base64 encoded images
 * @returns {Promise<string[]>} Array of public URLs
 */
export const uploadPhotos = async (trialId, photoKey, base64DataArray) => {
  const urls = [];
  for (let i = 0; i < base64DataArray.length; i++) {
    const base64Data = base64DataArray[i];

    // Skip if already a URL (not base64)
    if (base64Data.startsWith('http')) {
      urls.push(base64Data);
      continue;
    }

    try {
      const url = await uploadPhoto(trialId, photoKey, base64Data, i);
      urls.push(url);
    } catch (error) {
      console.error(`[Storage] Failed to upload photo ${i} for ${photoKey}:`, error);
      // Keep the base64 data as fallback if upload fails
      urls.push(base64Data);
    }
  }
  return urls;
};

/**
 * Delete a photo from Supabase Storage
 * @param {string} photoUrl - Full URL of the photo
 * @returns {Promise<void>}
 */
export const deletePhoto = async (photoUrl) => {
  try {
    // Extract file path from URL
    const url = new URL(photoUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/trial-photos\/(.+)$/);

    if (!pathMatch) {
      console.warn('[Storage] Could not extract file path from URL:', photoUrl);
      return;
    }

    const filePath = pathMatch[1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('[Storage] Delete error:', error);
      throw error;
    }

    console.log(`[Storage] Photo deleted: ${filePath}`);
  } catch (error) {
    console.error('[Storage] Error deleting photo:', error);
    throw error;
  }
};

/**
 * Delete all photos for a trial
 * @param {string} trialId - Trial UUID
 * @returns {Promise<void>}
 */
export const deleteTrialPhotos = async (trialId) => {
  try {
    // List all files in the trial's folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(trialId);

    if (listError) {
      console.error('[Storage] Error listing files:', listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log(`[Storage] No photos to delete for trial ${trialId}`);
      return;
    }

    // Delete all files
    const filePaths = files.map(file => `${trialId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error('[Storage] Error deleting files:', deleteError);
      throw deleteError;
    }

    console.log(`[Storage] Deleted ${files.length} photos for trial ${trialId}`);
  } catch (error) {
    console.error('[Storage] Error deleting trial photos:', error);
    throw error;
  }
};

/**
 * Convert all photos in a trial from base64 to storage URLs
 * @param {string} trialId - Trial UUID
 * @param {Object} photos - Photos object with base64 data
 * @returns {Promise<Object>} Photos object with storage URLs
 */
export const migratePhotosToStorage = async (trialId, photos) => {
  if (!photos || Object.keys(photos).length === 0) {
    return photos;
  }

  console.log(`[Storage] Migrating photos for trial ${trialId}`);

  const migratedPhotos = {};

  for (const [key, photoArray] of Object.entries(photos)) {
    if (Array.isArray(photoArray)) {
      migratedPhotos[key] = await uploadPhotos(trialId, key, photoArray);
    } else {
      // Single photo (string)
      if (photoArray.startsWith('http')) {
        migratedPhotos[key] = photoArray;
      } else {
        try {
          migratedPhotos[key] = await uploadPhoto(trialId, key, photoArray, 0);
        } catch (error) {
          migratedPhotos[key] = photoArray; // Keep base64 as fallback
        }
      }
    }
  }

  return migratedPhotos;
};

/**
 * Check if a value is a base64 data URL
 * @param {string} value - Value to check
 * @returns {boolean}
 */
export const isBase64DataUrl = (value) => {
  return typeof value === 'string' && value.startsWith('data:');
};

/**
 * Check if photos object contains any base64 data that needs migration
 * @param {Object} photos - Photos object
 * @returns {boolean}
 */
export const needsMigration = (photos) => {
  if (!photos || Object.keys(photos).length === 0) {
    return false;
  }

  for (const photoArray of Object.values(photos)) {
    if (Array.isArray(photoArray)) {
      if (photoArray.some(isBase64DataUrl)) {
        return true;
      }
    } else if (isBase64DataUrl(photoArray)) {
      return true;
    }
  }

  return false;
};

/**
 * Ensure the storage bucket exists (for initial setup)
 * Note: This requires service role key, so it's typically done via Supabase dashboard
 * This function is mainly for documentation purposes
 */
export const ensureBucketExists = async () => {
  console.log(`
[Storage] To set up the storage bucket, run this SQL in Supabase SQL Editor:

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('plot-images', 'plot-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload
CREATE POLICY "Users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plot-images');

-- Create policy to allow public read access
CREATE POLICY "Photos are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'plot-images');

-- Create policy to allow users to delete their own photos
CREATE POLICY "Users can delete their photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plot-images');
  `);
};
