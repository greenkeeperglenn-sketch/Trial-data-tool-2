-- =====================================================
-- Add metadata fields to trials table
-- =====================================================

-- Add new metadata columns to trials table
ALTER TABLE trials
ADD COLUMN IF NOT EXISTS trialist_name TEXT,
ADD COLUMN IF NOT EXISTS client_sponsor TEXT,
ADD COLUMN IF NOT EXISTS contact_info TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- Create index for metadata JSONB field
CREATE INDEX IF NOT EXISTS idx_trials_metadata
ON trials USING GIN(metadata);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Run this migration in your Supabase SQL editor to add
-- the new metadata fields to existing trials
-- =====================================================
