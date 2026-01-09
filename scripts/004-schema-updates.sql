-- Service Manager 1.0 - Schema Updates
-- This script applies updates to the existing schema to support:
-- 1. Login codes for users
-- 2. Many-to-many job-technician assignments
-- 3. Many-to-many job-equipment assignments
-- 4. Equipment tracking on attachments
-- 5. In-app notifications
-- 6. 'accepted' status for jobs

-- ============================================================================
-- 1. ADD LOGIN_CODE TO USERS TABLE
-- ============================================================================

-- Add login_code column to users table for human-readable login IDs
ALTER TABLE users ADD COLUMN login_code TEXT UNIQUE;

-- Create index for login_code lookups
CREATE INDEX idx_users_login_code ON users(login_code);

COMMENT ON COLUMN users.login_code IS 'Human-readable login ID (e.g., SU001 for managers, U001 for technicians). Used as an additional identifier alongside email.';

-- ============================================================================
-- 2. CREATE JOB_TECHNICIANS JUNCTION TABLE
-- ============================================================================

-- Many-to-many relationship between jobs and technicians
-- Supports multiple technicians assigned to a single job
CREATE TABLE job_technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    google_event_id TEXT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, technician_id)
);

-- Indexes for job_technicians
CREATE INDEX idx_job_technicians_job_id ON job_technicians(job_id);
CREATE INDEX idx_job_technicians_technician_id ON job_technicians(technician_id);
CREATE INDEX idx_job_technicians_status ON job_technicians(status);

-- Trigger for updated_at
CREATE TRIGGER update_job_technicians_updated_at 
BEFORE UPDATE ON job_technicians 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE job_technicians IS 'Junction table for many-to-many relationship between jobs and technicians. Allows multiple technicians per job with individual acceptance tracking and Google Calendar event IDs.';
COMMENT ON COLUMN job_technicians.google_event_id IS 'Google Calendar event ID for this specific technician assignment.';
COMMENT ON COLUMN job_technicians.status IS 'Assignment status: pending (assigned but not responded), accepted (tech confirmed), declined (tech rejected), cancelled (assignment revoked).';

-- ============================================================================
-- 3. CREATE JOB_EQUIPMENT JUNCTION TABLE
-- ============================================================================

-- Many-to-many relationship between jobs and equipment
-- Tracks which equipment/units are serviced in each job
CREATE TABLE job_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    expected_reports INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, equipment_id)
);

-- Indexes for job_equipment
CREATE INDEX idx_job_equipment_job_id ON job_equipment(job_id);
CREATE INDEX idx_job_equipment_equipment_id ON job_equipment(equipment_id);

-- Trigger for updated_at
CREATE TRIGGER update_job_equipment_updated_at 
BEFORE UPDATE ON job_equipment 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE job_equipment IS 'Junction table linking jobs to specific equipment/units being serviced. Tracks expected report count per equipment for progress tracking.';
COMMENT ON COLUMN job_equipment.expected_reports IS 'Number of photos/reports expected to be uploaded for this equipment on this job. Used to calculate "X / Y reports uploaded" progress.';

-- ============================================================================
-- 4. ADD EQUIPMENT_ID TO JOB_ATTACHMENTS TABLE
-- ============================================================================

-- Add equipment_id to link attachments to specific units
ALTER TABLE job_attachments ADD COLUMN equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

-- Create index for equipment_id lookups
CREATE INDEX idx_job_attachments_equipment_id ON job_attachments(equipment_id);

COMMENT ON COLUMN job_attachments.equipment_id IS 'Links attachment to specific equipment/unit. Allows tracking which reports belong to which unit for "X / Y reports uploaded" calculations.';

-- ============================================================================
-- 5. CREATE NOTIFICATIONS TABLE
-- ============================================================================

-- In-app notifications for managers and technicians
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT NULL,
    related_entity_id UUID NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_recipient_user_id ON notifications(recipient_user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_user_id, is_read) WHERE is_read = false;

COMMENT ON TABLE notifications IS 'In-app notification system for managers and technicians. Supports events like job assignments, acceptances, report uploads, and contract alerts.';
COMMENT ON COLUMN notifications.type IS 'Notification type: job_assigned, job_accepted, job_declined, report_uploaded, contract_scheduling_needed, contract_renewal_needed, contract_ended, etc.';
COMMENT ON COLUMN notifications.related_entity_type IS 'Type of entity this notification references (e.g., job, service_agreement, equipment).';
COMMENT ON COLUMN notifications.related_entity_id IS 'UUID of the related entity for deep linking in the UI.';

-- ============================================================================
-- 6. UPDATE JOBS TABLE STATUS TO INCLUDE 'ACCEPTED'
-- ============================================================================

-- Drop existing CHECK constraint on status
ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;

-- Add new CHECK constraint including 'accepted' status
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN ('draft', 'scheduled', 'accepted', 'dispatched', 'in_progress', 'completed', 'cancelled', 'on_hold'));

COMMENT ON COLUMN jobs.status IS 'Job workflow status: draft (being created), scheduled (date set), accepted (all techs confirmed), dispatched (techs en route), in_progress (work started), completed (finished), cancelled (stopped), on_hold (paused).';
