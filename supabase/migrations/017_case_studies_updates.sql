-- Case Studies Updates Migration
-- Adds tags array and key_takeaway columns

-- ============================================
-- ADD NEW COLUMNS
-- ============================================

-- Add tags column (array of text)
ALTER TABLE case_studies 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add key_takeaway column for the yellow highlight box
ALTER TABLE case_studies 
ADD COLUMN IF NOT EXISTS key_takeaway TEXT;

-- ============================================
-- CREATE INDEX FOR TAGS
-- ============================================

-- GIN index for efficient tag searching
CREATE INDEX IF NOT EXISTS idx_case_studies_tags ON case_studies USING GIN (tags);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN case_studies.tags IS 'Array of category tags for filtering (e.g., SMC/Aid & Attendance, Primary Service Connection)';
COMMENT ON COLUMN case_studies.key_takeaway IS 'Key takeaway text displayed in yellow highlight box';
