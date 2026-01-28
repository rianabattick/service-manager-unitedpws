# Schema Updates Documentation

## Overview

This document explains the schema updates applied to support enhanced multi-technician job assignments, equipment tracking, notifications, and login codes.

---

## 1. Login Codes for Users

### Changes
- Added `login_code TEXT UNIQUE` column to `users` table
- Created index on `login_code` for fast lookups

### Purpose
Provides human-readable login identifiers (e.g., "SU001" for managers, "U001" for technicians) as an alternative to email-based authentication.

### Usage
\`\`\`sql
-- Assign login codes to users
UPDATE users SET login_code = 'SU001' WHERE email = 'manager@example.com';
UPDATE users SET login_code = 'U001' WHERE email = 'tech1@example.com';

-- Query by login code
SELECT * FROM users WHERE login_code = 'U001';
\`\`\`

---

## 2. Job-Technician Many-to-Many Relationship

### New Table: `job_technicians`

**Purpose:** Supports multiple technicians assigned to a single job, each with individual acceptance status and Google Calendar integration.

**Key Columns:**
- `job_id` - References the job
- `technician_id` - References the assigned technician
- `status` - Assignment status: 'pending', 'accepted', 'declined', 'cancelled'
- `google_event_id` - Google Calendar event ID for this technician's assignment
- `assigned_at` - When the assignment was created
- `responded_at` - When the technician accepted/declined

**Relationship with existing `jobs.assigned_to`:**
- `jobs.assigned_to` can still be used for simple single-technician assignments
- `job_technicians` table is used when multiple technicians are needed
- Both can coexist - `assigned_to` might represent the "lead" technician

### Usage Examples

**Assigning Multiple Technicians to a Job:**
\`\`\`sql
-- Assign two technicians to a job
INSERT INTO job_technicians (job_id, technician_id, status)
VALUES 
  ('job-uuid-1', 'tech1-uuid', 'pending'),
  ('job-uuid-1', 'tech2-uuid', 'pending');
\`\`\`

**Technician Accepts Assignment:**
\`\`\`sql
UPDATE job_technicians
SET status = 'accepted', responded_at = NOW()
WHERE job_id = 'job-uuid-1' AND technician_id = 'tech1-uuid';
\`\`\`

**Check if All Technicians Accepted:**
\`\`\`sql
-- Count pending assignments for a job
SELECT COUNT(*) as pending_count
FROM job_technicians
WHERE job_id = 'job-uuid-1' AND status = 'pending';

-- If pending_count = 0, update job status to 'accepted'
UPDATE jobs SET status = 'accepted' WHERE id = 'job-uuid-1';
\`\`\`

**Storing Google Calendar Event ID:**
\`\`\`sql
UPDATE job_technicians
SET google_event_id = 'google-calendar-event-id-xyz'
WHERE job_id = 'job-uuid-1' AND technician_id = 'tech1-uuid';
\`\`\`

---

## 3. Job-Equipment Many-to-Many Relationship

### New Table: `job_equipment`

**Purpose:** Explicitly tracks which equipment/units are serviced in each job and how many reports are expected per unit.

**Key Columns:**
- `job_id` - References the job
- `equipment_id` - References the equipment/unit being serviced
- `expected_reports` - Number of photos/documents expected for this equipment (default: 1)
- `notes` - Additional notes about this equipment on this job

### Usage Examples

**Link Equipment to a Job:**
\`\`\`sql
-- A maintenance job servicing 3 HVAC units
INSERT INTO job_equipment (job_id, equipment_id, expected_reports)
VALUES 
  ('job-uuid-1', 'hvac-unit-1-uuid', 2), -- Expect 2 photos
  ('job-uuid-1', 'hvac-unit-2-uuid', 2),
  ('job-uuid-1', 'hvac-unit-3-uuid', 1); -- Expect 1 photo
\`\`\`

**Calculate "X / Y Reports Uploaded" for a Job:**
\`\`\`sql
SELECT 
  je.equipment_id,
  e.name AS equipment_name,
  je.expected_reports,
  COUNT(ja.id) AS reports_uploaded,
  CONCAT(COUNT(ja.id), ' / ', je.expected_reports) AS progress
FROM job_equipment je
JOIN equipment e ON e.id = je.equipment_id
LEFT JOIN job_attachments ja ON ja.job_id = je.job_id 
  AND ja.equipment_id = je.equipment_id
  AND ja.type IN ('photo', 'document')
WHERE je.job_id = 'job-uuid-1'
GROUP BY je.equipment_id, e.name, je.expected_reports;
\`\`\`

**Example Result:**
\`\`\`
equipment_id          | equipment_name | expected_reports | reports_uploaded | progress
----------------------|----------------|------------------|------------------|----------
hvac-unit-1-uuid      | Unit A         | 2                | 2                | 2 / 2
hvac-unit-2-uuid      | Unit B         | 2                | 1                | 1 / 2
hvac-unit-3-uuid      | Unit C         | 1                | 0                | 0 / 1
\`\`\`

---

## 4. Equipment ID on Job Attachments

### Changes
- Added `equipment_id UUID` column to `job_attachments` table (nullable, FK to `equipment`)
- Created index on `equipment_id`

### Purpose
Links each attachment (photo/document/report) to a specific equipment/unit, enabling granular tracking of which reports have been uploaded for each unit.

### Usage Examples

**Upload a Photo for Specific Equipment:**
\`\`\`sql
INSERT INTO job_attachments (
  job_id, 
  equipment_id,  -- Link to specific unit
  type, 
  file_url, 
  file_name, 
  uploaded_by
)
VALUES (
  'job-uuid-1',
  'hvac-unit-1-uuid',
  'photo',
  'https://storage.example.com/report-photo.jpg',
  'unit-a-inspection.jpg',
  'tech1-uuid'
);
\`\`\`

**Find All Reports for a Specific Equipment:**
\`\`\`sql
SELECT *
FROM job_attachments
WHERE job_id = 'job-uuid-1' 
  AND equipment_id = 'hvac-unit-1-uuid'
  AND type IN ('photo', 'document');
\`\`\`

---

## 5. Notifications Table

### New Table: `notifications`

**Purpose:** In-app notification system for managers and technicians to receive alerts about job assignments, acceptances, report uploads, and contract events.

**Key Columns:**
- `recipient_user_id` - User who receives the notification
- `type` - Notification type (e.g., 'job_assigned', 'contract_renewal_needed')
- `message` - Human-readable notification message
- `related_entity_type` - Type of entity ('job', 'service_agreement', 'equipment')
- `related_entity_id` - UUID of the related entity for deep linking
- `is_read` - Whether the notification has been read
- `read_at` - Timestamp when marked as read

### Usage Examples

#### Event: Technician Assigned to Job
\`\`\`sql
-- Create notification when technician is assigned
INSERT INTO notifications (
  organization_id,
  recipient_user_id,
  type,
  message,
  related_entity_type,
  related_entity_id
)
SELECT 
  j.organization_id,
  jt.technician_id,
  'job_assigned',
  'You have been assigned to job ' || j.job_number || ' at ' || c.first_name || ' ' || c.last_name,
  'job',
  j.id
FROM job_technicians jt
JOIN jobs j ON j.id = jt.job_id
JOIN customers c ON c.id = j.customer_id
WHERE jt.id = 'newly-created-assignment-uuid';
\`\`\`

#### Event: Technician Accepts Job
\`\`\`sql
-- Notify manager when technician accepts
INSERT INTO notifications (
  organization_id,
  recipient_user_id,
  type,
  message,
  related_entity_type,
  related_entity_id
)
SELECT 
  u.organization_id,
  manager.id,
  'job_accepted',
  u.full_name || ' accepted job ' || j.job_number,
  'job',
  j.id
FROM job_technicians jt
JOIN jobs j ON j.id = jt.job_id
JOIN users u ON u.id = jt.technician_id
CROSS JOIN users manager
WHERE jt.status = 'accepted'
  AND manager.organization_id = u.organization_id
  AND manager.role IN ('owner', 'admin', 'manager');
\`\`\`

#### Event: Report Uploaded
\`\`\`sql
-- Notify manager when technician uploads a report
INSERT INTO notifications (
  organization_id,
  recipient_user_id,
  type,
  message,
  related_entity_type,
  related_entity_id
)
SELECT 
  j.organization_id,
  manager.id,
  'report_uploaded',
  u.full_name || ' uploaded a report for job ' || j.job_number,
  'job',
  j.id
FROM job_attachments ja
JOIN jobs j ON j.id = ja.job_id
JOIN users u ON u.id = ja.uploaded_by
CROSS JOIN users manager
WHERE ja.id = 'newly-uploaded-attachment-uuid'
  AND manager.organization_id = j.organization_id
  AND manager.role IN ('owner', 'admin', 'manager');
\`\`\`

#### Event: Contract Scheduling Needed
\`\`\`sql
-- Daily cron job to check contracts needing service scheduling
INSERT INTO notifications (
  organization_id,
  recipient_user_id,
  type,
  message,
  related_entity_type,
  related_entity_id
)
SELECT 
  sa.organization_id,
  manager.id,
  'contract_scheduling_needed',
  'Service agreement ' || sa.agreement_number || ' needs job scheduling (due: ' || sa.next_service_date || ')',
  'service_agreement',
  sa.id
FROM service_agreements sa
CROSS JOIN users manager
WHERE sa.status = 'active'
  AND sa.next_service_date <= CURRENT_DATE + INTERVAL '7 days'
  AND manager.organization_id = sa.organization_id
  AND manager.role IN ('owner', 'admin', 'manager', 'dispatcher')
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.related_entity_id = sa.id
      AND n.type = 'contract_scheduling_needed'
      AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
  );
\`\`\`

#### Event: Contract Renewal Needed
\`\`\`sql
-- Daily cron job to check contracts expiring soon
INSERT INTO notifications (
  organization_id,
  recipient_user_id,
  type,
  message,
  related_entity_type,
  related_entity_id
)
SELECT 
  sa.organization_id,
  manager.id,
  'contract_renewal_needed',
  'Service agreement ' || sa.agreement_number || ' expires on ' || sa.end_date || ' - contact customer for renewal',
  'service_agreement',
  sa.id
FROM service_agreements sa
CROSS JOIN users manager
WHERE sa.status = 'active'
  AND sa.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  AND manager.organization_id = sa.organization_id
  AND manager.role IN ('owner', 'admin', 'manager')
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.related_entity_id = sa.id
      AND n.type = 'contract_renewal_needed'
      AND n.created_at > CURRENT_DATE - INTERVAL '7 days'
  );
\`\`\`

#### Event: Contract Ended
\`\`\`sql
-- Daily cron job to notify about expired contracts
INSERT INTO notifications (
  organization_id,
  recipient_user_id,
  type,
  message,
  related_entity_type,
  related_entity_id
)
SELECT 
  sa.organization_id,
  manager.id,
  'contract_ended',
  'Service agreement ' || sa.agreement_number || ' has expired',
  'service_agreement',
  sa.id
FROM service_agreements sa
CROSS JOIN users manager
WHERE sa.status = 'active'
  AND sa.end_date = CURRENT_DATE
  AND manager.organization_id = sa.organization_id
  AND manager.role IN ('owner', 'admin', 'manager');

-- Also update the contract status
UPDATE service_agreements
SET status = 'expired'
WHERE status = 'active' AND end_date = CURRENT_DATE;
\`\`\`

**Mark Notification as Read:**
\`\`\`sql
UPDATE notifications
SET is_read = true, read_at = NOW()
WHERE id = 'notification-uuid' AND recipient_user_id = auth.uid();
\`\`\`

**Get Unread Count:**
\`\`\`sql
SELECT COUNT(*) as unread_count
FROM notifications
WHERE recipient_user_id = auth.uid() AND is_read = false;
\`\`\`

---

## 6. Job Status: Added 'accepted'

### Changes
- Updated `jobs.status` CHECK constraint to include 'accepted' as a valid status

### Status Workflow
\`\`\`
draft → scheduled → accepted → dispatched → in_progress → completed
                                    ↓
                              cancelled / on_hold
\`\`\`

**Status Meanings:**
- `draft` - Job is being created
- `scheduled` - Date/time set, technicians assigned (pending acceptance)
- **`accepted`** - All assigned technicians have confirmed (NEW)
- `dispatched` - Technicians are en route
- `in_progress` - Work has started
- `completed` - Job finished
- `cancelled` - Job was cancelled
- `on_hold` - Job is paused

### Usage Example

**Update Job to 'accepted' When All Technicians Accept:**
\`\`\`sql
-- Trigger or application logic after technician accepts
UPDATE jobs
SET status = 'accepted'
WHERE id = 'job-uuid-1'
  AND status = 'scheduled'
  AND NOT EXISTS (
    -- Check if any technicians haven't accepted yet
    SELECT 1 FROM job_technicians jt
    WHERE jt.job_id = 'job-uuid-1'
      AND jt.status = 'pending'
  );
\`\`\`

---

## Complete Workflow Example: Multi-Technician Job with Reports

### Step 1: Create Job
\`\`\`sql
INSERT INTO jobs (organization_id, customer_id, job_number, title, type, status)
VALUES ('org-uuid', 'customer-uuid', 'JOB-2025-001', 'Quarterly Maintenance', 'maintenance', 'scheduled');
\`\`\`

### Step 2: Assign Technicians
\`\`\`sql
INSERT INTO job_technicians (job_id, technician_id, status)
VALUES 
  ('job-uuid', 'tech1-uuid', 'pending'),
  ('job-uuid', 'tech2-uuid', 'pending');

-- Create notifications for each technician
-- (See notification examples above)
\`\`\`

### Step 3: Link Equipment
\`\`\`sql
INSERT INTO job_equipment (job_id, equipment_id, expected_reports)
VALUES 
  ('job-uuid', 'hvac-1-uuid', 2),
  ('job-uuid', 'hvac-2-uuid', 2);
\`\`\`

### Step 4: Technicians Accept
\`\`\`sql
UPDATE job_technicians
SET status = 'accepted', responded_at = NOW()
WHERE job_id = 'job-uuid' AND technician_id = 'tech1-uuid';

-- If all techs accepted, update job status
UPDATE jobs SET status = 'accepted' WHERE id = 'job-uuid';
\`\`\`

### Step 5: Upload Reports
\`\`\`sql
-- Tech 1 uploads photo for HVAC Unit 1
INSERT INTO job_attachments (job_id, equipment_id, type, file_url, file_name, uploaded_by)
VALUES ('job-uuid', 'hvac-1-uuid', 'photo', 'url1', 'hvac1-before.jpg', 'tech1-uuid');

-- Tech 2 uploads photo for HVAC Unit 2
INSERT INTO job_attachments (job_id, equipment_id, type, file_url, file_name, uploaded_by)
VALUES ('job-uuid', 'hvac-2-uuid', 'photo', 'url2', 'hvac2-after.jpg', 'tech2-uuid');
\`\`\`

### Step 6: Check Progress
\`\`\`sql
SELECT 
  e.name,
  je.expected_reports,
  COUNT(ja.id) AS uploaded,
  CONCAT(COUNT(ja.id), ' / ', je.expected_reports) AS progress
FROM job_equipment je
JOIN equipment e ON e.id = je.equipment_id
LEFT JOIN job_attachments ja ON ja.job_id = je.job_id AND ja.equipment_id = je.equipment_id
WHERE je.job_id = 'job-uuid'
GROUP BY e.name, je.expected_reports;
\`\`\`

---

## Summary

These schema updates enable:
1. **Login codes** for user-friendly authentication
2. **Multi-technician jobs** with individual acceptance tracking
3. **Equipment tracking** for granular report management
4. **"X / Y reports uploaded"** progress calculation per unit
5. **In-app notifications** for real-time event awareness
6. **Enhanced job workflow** with 'accepted' status

All tables have RLS policies enabled for multi-tenant security and appropriate indexes for performance.
