-- =====================================================
-- Expert Answers Feature - Add is_expert_answer column
-- =====================================================

-- Add is_expert_answer column to community_answers
ALTER TABLE community_answers 
ADD COLUMN IF NOT EXISTS is_expert_answer BOOLEAN DEFAULT false;

-- Create index for expert answers (for sorting)
CREATE INDEX IF NOT EXISTS idx_answers_expert ON community_answers(is_expert_answer) WHERE is_expert_answer = true;
