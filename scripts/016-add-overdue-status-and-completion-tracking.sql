-- Add 'overdue' as a valid job status
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs
ADD CONSTRAINT jobs_status_check
CHECK (status IN (
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'on_hold',
  'overdue',
  -- Legacy values for backward compatibility
  'draft',
  'scheduled',
  'accepted',
  'dispatched',
  'in_progress'
));

-- Add completed_by and completed_at fields to completion_checklists table
ALTER TABLE completion_checklists
ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Add comment for the updated constraint
COMMENT ON CONSTRAINT jobs_status_check ON jobs IS 
  'Valid statuses: pending, confirmed, completed, cancelled, on_hold, overdue (new); draft, scheduled, accepted, dispatched, in_progress (legacy)';
