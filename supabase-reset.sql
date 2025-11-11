-- =====================================================
-- RESET SCRIPT - Only use if you need to start fresh
-- WARNING: This will delete all trial data!
-- =====================================================

-- Drop existing objects
DROP TRIGGER IF EXISTS update_trials_last_modified ON trials;
DROP FUNCTION IF EXISTS update_last_modified_column();
DROP FUNCTION IF EXISTS get_user_trial_count();
DROP TABLE IF EXISTS trials CASCADE;

-- Now run the full supabase-migration.sql file after this
