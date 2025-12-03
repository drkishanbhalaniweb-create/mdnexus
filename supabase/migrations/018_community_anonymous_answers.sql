-- Allow anonymous answers with email for notifications
-- Add user_email column to community_answers table

-- Add user_email column
ALTER TABLE community_answers 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Make user_id nullable for anonymous users
ALTER TABLE community_answers 
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policy to allow anonymous inserts
DROP POLICY IF EXISTS "Anyone can insert answers" ON community_answers;
CREATE POLICY "Anyone can insert answers"
    ON community_answers FOR INSERT
    WITH CHECK (true);

-- Update RLS policy to allow public to view published answers
DROP POLICY IF EXISTS "Published answers are viewable by everyone" ON community_answers;
CREATE POLICY "Published answers are viewable by everyone"
    ON community_answers FOR SELECT
    USING (status = 'published');

COMMENT ON COLUMN community_answers.user_email IS 'Email for notifications (not displayed publicly)';
