-- Migration 010: Update job statuses and add new fields

-- 1. Add email column to job_contacts table
ALTER TABLE job_contacts
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Add is_lead column to job_technicians table
ALTER TABLE job_technicians
ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT FALSE;

-- 3. Update job status check constraint to use new values
-- First, update existing data to new statuses
UPDATE jobs SET status = 'pending' WHERE status IN ('draft', 'scheduled');
UPDATE jobs SET status = 'confirmed' WHERE status IN ('accepted', 'dispatched');
UPDATE jobs SET status = 'completed' WHERE status = 'in_progress' OR status = 'completed';

-- Drop old constraint if it exists
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Add new constraint with updated status values
ALTER TABLE jobs
ADD CONSTRAINT jobs_status_check
CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'on_hold'));

-- 4. Update job_technicians to set default status to 'accepted' for existing records
UPDATE job_technicians SET status = 'accepted' WHERE status = 'pending';

-- Add comment to document the schema change
COMMENT ON COLUMN jobs.status IS 'Job status: pending, confirmed, completed, cancelled, on_hold';
COMMENT ON COLUMN job_contacts.email IS 'Contact email address (optional)';
COMMENT ON COLUMN job_technicians.is_lead IS 'Marks if this technician is the lead for this job';
