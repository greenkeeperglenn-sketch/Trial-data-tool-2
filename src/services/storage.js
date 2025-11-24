import { supabase } from './supabase';

/**
 * Storage service for plot images in Supabase Storage
 * Uses the 'plot-images' bucket
 */

const BUCKET_NAME = 'plot-images';

/**
 * Upload an image file to storage
 * @param {string} trialId - Trial UUID
 * @param {string} dateStr - Assessment date (YYYY-MM-DD)
 * @param {string} plotId - Plot ID (e.g., "1-1")
 * @param {File} file - Image file to upload
 * @param {number} index - Index of the photo for this plot/date
 * @returns {Promise<string>} Storage path of uploaded file
 */
export const uploadPlotImage = async (trialId, dateStr, plotId, file, index) => {
  try {
    // Generate unique file path: trialId/date_plotId_index.ext
    const fileExt = file.name.split('.').pop();
    const fileName = `${dateStr}_${plotId}_${index}_${Date.now()}.${fileExt}`;
    const filePath = `${trialId}/${fileName}`;

    console.log('[storage] Uploading image:', filePath);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    console.log('[storage] Upload successful:', data.path);
    return data.path;
  } catch (error) {
    console.error('[storage] Upload error:', error);
    throw error;
  }
};

/**
 * Get public URL for an image
 * @param {string} path - Storage path of the image
 * @returns {string} Public URL
 */
export const getImageUrl = (path) => {
  if (!path) return '';

  // If it's already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // If it's a base64 data URL (old format), return as-is
  if (path.startsWith('data:')) {
    return path;
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
};

/**
 * Delete an image from storage
 * @param {string} path - Storage path of the image
 * @returns {Promise<void>}
 */
export const deletePlotImage = async (path) => {
  try {
    // Don't try to delete base64 data URLs (old format)
    if (!path || path.startsWith('data:')) {
      return;
    }

    // Don't try to delete full URLs
    if (path.startsWith('http://') || path.startsWith('https://')) {
      console.warn('[storage] Cannot delete full URL, need storage path:', path);
      return;
    }

    console.log('[storage] Deleting image:', path);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) throw error;

    console.log('[storage] Delete successful');
  } catch (error) {
    console.error('[storage] Delete error:', error);
    throw error;
  }
};

/**
 * Delete multiple images from storage
 * @param {string[]} paths - Array of storage paths
 * @returns {Promise<void>}
 */
export const deletePlotImages = async (paths) => {
  try {
    // Filter out base64 data URLs and full URLs
    const validPaths = paths.filter(path =>
      path &&
      !path.startsWith('data:') &&
      !path.startsWith('http://') &&
      !path.startsWith('https://')
    );

    if (validPaths.length === 0) {
      console.log('[storage] No valid paths to delete');
      return;
    }

    console.log('[storage] Deleting images:', validPaths);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(validPaths);

    if (error) throw error;

    console.log('[storage] Bulk delete successful');
  } catch (error) {
    console.error('[storage] Bulk delete error:', error);
    throw error;
  }
};

/**
 * Delete all images for a trial
 * @param {string} trialId - Trial UUID
 * @returns {Promise<void>}
 */
export const deleteTrialImages = async (trialId) => {
  try {
    console.log('[storage] Deleting all images for trial:', trialId);

    // List all files in the trial folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(trialId);

    if (listError) throw listError;

    if (!files || files.length === 0) {
      console.log('[storage] No images found for trial');
      return;
    }

    // Delete all files
    const filePaths = files.map(file => `${trialId}/${file.name}`);
    await deletePlotImages(filePaths);

    console.log('[storage] All trial images deleted');
  } catch (error) {
    console.error('[storage] Delete trial images error:', error);
    throw error;
  }
};

/**
 * Convert a File or Blob to base64 (for backwards compatibility during migration)
 * @param {File|Blob} file - File to convert
 * @returns {Promise<string>} Base64 data URL
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
