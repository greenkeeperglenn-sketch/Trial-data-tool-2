-- =====================================================
-- STRI Trial Data Tool - Supabase Database Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TRIALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS trials (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Trial metadata
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_modified TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Trial configuration (JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Layout data
  grid_layout JSONB NOT NULL DEFAULT '[]'::JSONB,
  orientation INTEGER DEFAULT 0 NOT NULL,
  layout_locked BOOLEAN DEFAULT FALSE NOT NULL,

  -- Assessment data
  assessment_dates JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Media and notes
  photos JSONB NOT NULL DEFAULT '{}'::JSONB,
  notes JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Search and indexing
  CONSTRAINT trials_name_check CHECK (char_length(name) >= 1)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for user's trials (most common query)
CREATE INDEX IF NOT EXISTS idx_trials_user_id
ON trials(user_id);

-- Index for modified date (for sorting)
CREATE INDEX IF NOT EXISTS idx_trials_last_modified
ON trials(last_modified DESC);

-- Index for user + modified (composite for efficient queries)
CREATE INDEX IF NOT EXISTS idx_trials_user_modified
ON trials(user_id, last_modified DESC);

-- GIN indexes for JSONB searching (if needed in future)
CREATE INDEX IF NOT EXISTS idx_trials_config
ON trials USING GIN(config);

CREATE INDEX IF NOT EXISTS idx_trials_assessment_dates
ON trials USING GIN(assessment_dates);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on trials table
ALTER TABLE trials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own trials
CREATE POLICY "Users can view their own trials"
ON trials FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own trials
CREATE POLICY "Users can insert their own trials"
ON trials FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own trials
CREATE POLICY "Users can update their own trials"
ON trials FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own trials
CREATE POLICY "Users can delete their own trials"
ON trials FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update last_modified timestamp
CREATE OR REPLACE FUNCTION update_last_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_modified
CREATE TRIGGER update_trials_last_modified
BEFORE UPDATE ON trials
FOR EACH ROW
EXECUTE FUNCTION update_last_modified_column();

-- =====================================================
-- HELPER FUNCTIONS (Optional)
-- =====================================================

-- Function to get user's trial count
CREATE OR REPLACE FUNCTION get_user_trial_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM trials WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DEMO DATA (Optional - uncomment to insert)
-- =====================================================

/*
-- Insert demo trial (only if authenticated)
INSERT INTO trials (
  user_id,
  name,
  config,
  grid_layout,
  orientation,
  layout_locked,
  assessment_dates,
  photos,
  notes
) VALUES (
  auth.uid(),
  'Demo Trial',
  '{"trialName": "Demo Trial", "numBlocks": 4, "numTreatments": 4, "treatments": ["Treatment A", "Treatment B", "Treatment C", "Treatment D"], "assessmentTypes": [{"name": "Turf Quality", "min": 1, "max": 10}]}'::JSONB,
  '[]'::JSONB,
  0,
  false,
  '[]'::JSONB,
  '{}'::JSONB,
  '{}'::JSONB
);
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'trials';

-- Check RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'trials';

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'trials';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Set up your .env file with Supabase credentials
-- 2. Run the application
-- 3. Create a user account
-- 4. Create your first trial!
-- =====================================================
