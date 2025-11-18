import { supabase } from './supabase';

/**
 * Storage service for managing plot images in Supabase Storage
 * Bucket: 'plot-images'
 * Structure: {trialId}/{date}/{plotId}.jpg
 */

const BUCKET_NAME = 'plot-images';

/**
 * Upload a plot image to Supabase Storage
 * @param {Blob} imageBlob - The image blob to upload
 * @param {string} trialId - Trial UUID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} plotId - Plot identifier
 * @returns {Promise<string>} Public URL of uploaded image
 */
export const uploadPlotImage = async (imageBlob, trialId, date, plotId) => {
  try {
    // Create file path: trialId/date/plotId.jpg
    const fileName = `${trialId}/${date}/${plotId}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBlob, {
        contentType: 'image/jpeg',
        upsert: true, // Overwrite if exists
        cacheControl: '3600'
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading plot image:', error);
    throw error;
  }
};

/**
 * Upload multiple plot images in batch
 * @param {Array} uploads - Array of {imageBlob, trialId, date, plotId}
 * @param {Function} onProgress - Optional progress callback (current, total)
 * @returns {Promise<Object>} Map of plotId to public URL
 */
export const uploadPlotImages = async (uploads, onProgress) => {
  const results = {};

  for (let i = 0; i < uploads.length; i++) {
    const { imageBlob, trialId, date, plotId } = uploads[i];

    try {
      const url = await uploadPlotImage(imageBlob, trialId, date, plotId);
      results[plotId] = url;

      if (onProgress) {
        onProgress(i + 1, uploads.length);
      }
    } catch (error) {
      console.error(`Failed to upload plot ${plotId}:`, error);
      results[plotId] = null;
    }
  }

  return results;
};

/**
 * Delete a plot image from storage
 * @param {string} trialId - Trial UUID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} plotId - Plot identifier
 * @returns {Promise<void>}
 */
export const deletePlotImage = async (trialId, date, plotId) => {
  try {
    const fileName = `${trialId}/${date}/${plotId}.jpg`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting plot image:', error);
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
    // List all files in the trial folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(trialId, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) throw listError;

    if (files && files.length > 0) {
      const filePaths = files.map(file => `${trialId}/${file.name}`);

      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) throw deleteError;
    }
  } catch (error) {
    console.error('Error deleting trial images:', error);
    throw error;
  }
};

/**
 * Ensure the plot-images bucket exists (admin/setup function)
 * @returns {Promise<void>}
 */
export const ensureBucketExists = async () => {
  try {
    // Try to get the bucket
    const { data: buckets } = await supabase.storage.listBuckets();

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket with public access
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760 // 10MB max per file
      });

      if (error && !error.message.includes('already exists')) {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    // Don't throw - bucket might already exist or user might not have permission
  }
};
