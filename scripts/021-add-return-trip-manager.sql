-- Add manager-only return trip fields to jobs table
-- This is different from the existing return_trip_needed boolean which is for scheduling

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS manager_return_trip_needed BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS manager_return_trip_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS manager_return_trip_updated_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS manager_return_trip_updated_by UUID REFERENCES users(id) DEFAULT NULL;

-- Add comment to clarify difference
COMMENT ON COLUMN jobs.return_trip_needed IS 'Scheduling field: Is this job a return trip from another job';
COMMENT ON COLUMN jobs.manager_return_trip_needed IS 'Manager decision: Does this job require a follow-up return trip';
