-- Add new columns to jobs table for job detail view
-- These are NON-BREAKING additions only

-- Add job_type column (contracted or daily)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT;

-- Add service_type column (free-text field)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_type TEXT;

-- Add billing_status column
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS billing_status TEXT;

-- Add return_trip_needed column
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS return_trip_needed BOOLEAN NOT NULL DEFAULT false;

-- Add service_agreement_id FK
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_agreement_id UUID REFERENCES service_agreements(id) ON DELETE SET NULL;

-- Note: notes column already exists in the jobs table, no need to add it

-- Add comments
COMMENT ON COLUMN jobs.job_type IS 'Type of job: contracted or daily';
COMMENT ON COLUMN jobs.service_type IS 'Service type description (free-text)';
COMMENT ON COLUMN jobs.billing_status IS 'Billing status: sent_to_billing, invoiced, paid';
COMMENT ON COLUMN jobs.return_trip_needed IS 'Whether a return trip is required';
COMMENT ON COLUMN jobs.service_agreement_id IS 'Reference to service agreement if this is a contracted job';
