-- Fix all check constraints to match current application requirements

-- 1. Ensure jobs table has correct status constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs
ADD CONSTRAINT jobs_status_check
CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'on_hold'));

-- 2. Ensure job_technicians has correct status constraint  
ALTER TABLE job_technicians DROP CONSTRAINT IF EXISTS job_technicians_status_check;
ALTER TABLE job_technicians
ADD CONSTRAINT job_technicians_status_check
CHECK (status IN ('pending', 'accepted', 'declined'));

-- 3. Update any existing invalid statuses
UPDATE jobs SET status = 'confirmed' WHERE status NOT IN ('pending', 'confirmed', 'completed', 'cancelled', 'on_hold');
UPDATE job_technicians SET status = 'accepted' WHERE status NOT IN ('pending', 'accepted', 'declined');

-- 4. Add comments
COMMENT ON CONSTRAINT jobs_status_check ON jobs IS 'Valid statuses: pending, confirmed, completed, cancelled, on_hold';
COMMENT ON CONSTRAINT job_technicians_status_check ON job_technicians IS 'Valid statuses: pending, accepted, declined';
