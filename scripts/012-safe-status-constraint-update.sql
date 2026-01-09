-- Safe update of status constraints to support both old and new status values
-- This prevents breaking existing data while allowing new statuses

-- 1. Drop and recreate jobs status constraint with both old and new values
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs
ADD CONSTRAINT jobs_status_check
CHECK (status IN (
  -- New status values (what the app uses)
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'on_hold',
  -- Old status values (for backward compatibility)
  'draft',
  'scheduled',
  'accepted',
  'dispatched',
  'in_progress'
));

-- 2. Update job_technicians constraint (already correct, but ensuring it's set)
ALTER TABLE job_technicians DROP CONSTRAINT IF EXISTS job_technicians_status_check;
ALTER TABLE job_technicians
ADD CONSTRAINT job_technicians_status_check
CHECK (status IN ('pending', 'accepted', 'declined'));

-- 3. Add helpful comments
COMMENT ON CONSTRAINT jobs_status_check ON jobs IS 
  'Valid statuses: pending, confirmed, completed, cancelled, on_hold (new); draft, scheduled, accepted, dispatched, in_progress (legacy)';

COMMENT ON CONSTRAINT job_technicians_status_check ON job_technicians IS 
  'Valid statuses: pending, accepted, declined';

-- 4. No data migration needed - existing rows remain valid with expanded constraint
