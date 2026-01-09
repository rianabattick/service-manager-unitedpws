-- Add 'job_creation_needed' to the service_agreements status constraint

-- Drop the old constraint
ALTER TABLE service_agreements DROP CONSTRAINT IF EXISTS service_agreements_status_check;

-- Add the new constraint with 'job_creation_needed' status
ALTER TABLE service_agreements ADD CONSTRAINT service_agreements_status_check 
  CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'job_creation_needed'));
