import { supabase } from './supabase';

/**
 * Database service for trial data operations
 * All functions use Supabase client with Row Level Security
 */

// =====================================================
// TRIAL CRUD OPERATIONS
// =====================================================

/**
 * Get all trials for the current user
 * @returns {Promise<Object>} Trials object keyed by ID
 */
export const getAllTrials = async () => {
  try {
    const { data, error } = await supabase
      .from('trials')
      .select('*')
      .order('last_modified', { ascending: false });

    if (error) throw error;

    // Convert array to object keyed by ID for compatibility with existing code
    const trialsObject = {};
    data.forEach(trial => {
      trialsObject[trial.id] = convertFromDatabase(trial);
    });

    return trialsObject;
  } catch (error) {
    console.error('Error fetching trials:', error);
    throw error;
  }
};

/**
 * Get a single trial by ID
 * @param {string} trialId - Trial UUID
 * @returns {Promise<Object>} Trial data
 */
export const getTrial = async (trialId) => {
  try {
    const { data, error } = await supabase
      .from('trials')
      .select('*')
      .eq('id', trialId)
      .single();

    if (error) throw error;

    return convertFromDatabase(data);
  } catch (error) {
    console.error('Error fetching trial:', error);
    throw error;
  }
};

/**
 * Create a new trial
 * @param {Object} trialData - Trial data object
 * @returns {Promise<Object>} Created trial with ID
 */
export const createTrial = async (trialData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to create trials');
    }

    const dbTrial = convertToDatabase(trialData, user.id);

    const { data, error } = await supabase
      .from('trials')
      .insert(dbTrial)
      .select()
      .single();

    if (error) throw error;

    return convertFromDatabase(data);
  } catch (error) {
    console.error('Error creating trial:', error);
    throw error;
  }
};

/**
 * Update an existing trial
 * @param {string} trialId - Trial UUID
 * @param {Object} trialData - Updated trial data
 * @returns {Promise<Object>} Updated trial
 */
export const updateTrial = async (trialId, trialData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to update trials');
    }

    const dbTrial = convertToDatabase(trialData, user.id);
    delete dbTrial.id; // Don't update ID
    delete dbTrial.user_id; // Don't update user_id
    delete dbTrial.created_at; // Don't update created_at

    const { data, error } = await supabase
      .from('trials')
      .update(dbTrial)
      .eq('id', trialId)
      .select()
      .single();

    if (error) throw error;

    return convertFromDatabase(data);
  } catch (error) {
    console.error('Error updating trial:', error);
    throw error;
  }
};

/**
 * Delete a trial
 * @param {string} trialId - Trial UUID
 * @returns {Promise<void>}
 */
export const deleteTrial = async (trialId) => {
  try {
    const { error } = await supabase
      .from('trials')
      .delete()
      .eq('id', trialId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting trial:', error);
    throw error;
  }
};

// =====================================================
// DATA CONVERSION HELPERS
// =====================================================

/**
 * Convert trial data to database format (snake_case, JSONB)
 * @param {Object} trial - Trial data from app
 * @param {string} userId - User UUID
 * @returns {Object} Database-formatted trial
 */
const convertToDatabase = (trial, userId) => {
  const dbTrial = {
    user_id: userId,
    name: trial.name || trial.config?.trialName || 'Untitled Trial',
    config: trial.config,
    grid_layout: trial.gridLayout || [],
    orientation: trial.orientation || 0,
    layout_locked: trial.layoutLocked || false,
    assessment_dates: trial.assessmentDates || [],
    photos: trial.photos || {},
    notes: trial.notes || {},
    last_modified: trial.lastModified || new Date().toISOString()
  };

  // Only include id if it's a valid UUID (not a temp ID)
  if (trial.id && !trial.id.startsWith('temp-')) {
    dbTrial.id = trial.id;
  }

  // Only include created_at if it exists (for updates)
  if (trial.created) {
    dbTrial.created_at = trial.created;
  }

  return dbTrial;
};

/**
 * Convert database trial to app format (camelCase)
 * @param {Object} dbTrial - Trial data from database
 * @returns {Object} App-formatted trial
 */
const convertFromDatabase = (dbTrial) => {
  return {
    id: dbTrial.id,
    name: dbTrial.name,
    config: dbTrial.config,
    gridLayout: dbTrial.grid_layout,
    orientation: dbTrial.orientation,
    layoutLocked: dbTrial.layout_locked,
    assessmentDates: dbTrial.assessment_dates,
    photos: dbTrial.photos,
    notes: dbTrial.notes,
    created: dbTrial.created_at,
    lastModified: dbTrial.last_modified
  };
};

// =====================================================
// MIGRATION HELPER
// =====================================================

/**
 * Migrate trials from localStorage to Supabase
 * @param {Object} localTrials - Trials object from localStorage
 * @returns {Promise<Object>} Results with success/error counts
 */
export const migrateFromLocalStorage = async (localTrials) => {
  const results = {
    total: 0,
    success: 0,
    errors: []
  };

  try {
    const trialsList = Object.values(localTrials);
    results.total = trialsList.length;

    for (const trial of trialsList) {
      try {
        await createTrial(trial);
        results.success++;
      } catch (error) {
        results.errors.push({
          trialName: trial.name || trial.config?.trialName,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

// =====================================================
// REALTIME SUBSCRIPTIONS (Optional Enhancement)
// =====================================================

/**
 * Subscribe to trial changes
 * @param {Function} callback - Called when trials change
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToTrials = (callback) => {
  const subscription = supabase
    .channel('trials-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trials'
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => subscription.unsubscribe()
  };
};
