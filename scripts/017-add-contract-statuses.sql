-- Add new contract statuses: 'ended' and 'overdue'

-- Update service_agreements status constraint
ALTER TABLE service_agreements DROP CONSTRAINT IF EXISTS service_agreements_status_check;

ALTER TABLE service_agreements
ADD CONSTRAINT service_agreements_status_check
CHECK (status IN (
  'draft',
  'active',
  'expired',
  'cancelled',
  'job_creation_needed',
  'in_progress',
  'renewal_needed',
  'on_hold',
  'overdue',
  'ended'
));

-- Add comment explaining statuses
COMMENT ON CONSTRAINT service_agreements_status_check ON service_agreements IS 
  'Valid statuses: draft, active, expired, cancelled, job_creation_needed, in_progress, renewal_needed, on_hold, overdue, ended';
