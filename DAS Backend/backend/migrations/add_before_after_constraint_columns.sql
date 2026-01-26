-- Migration: Add before_after constraint columns to schedule_constraints table
-- Date: 2026-01-26
-- Description: Adds reference_subject_id and placement columns for the before_after constraint type

-- Add reference_subject_id column (foreign key to subjects table)
ALTER TABLE schedule_constraints 
ADD COLUMN IF NOT EXISTS reference_subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE;

-- Add placement column ('before' or 'after')
ALTER TABLE schedule_constraints 
ADD COLUMN IF NOT EXISTS placement VARCHAR(10);

-- Add comment for documentation
COMMENT ON COLUMN schedule_constraints.reference_subject_id IS 'For before_after constraint: the subject that this constraint references';
COMMENT ON COLUMN schedule_constraints.placement IS 'For before_after constraint: whether subject should be "before" or "after" the reference subject';
