-- Service Manager 1.0 - RLS Policies for New Tables
-- Row Level Security policies for job_technicians, job_equipment, and notifications

-- ============================================================================
-- RLS POLICIES FOR JOB_TECHNICIANS
-- ============================================================================

ALTER TABLE job_technicians ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view job_technician assignments in their organization
CREATE POLICY "Users can view job technician assignments in their organization"
ON job_technicians FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_technicians.job_id
        AND u.id = auth.uid()
    )
);

-- Policy: Users can insert job_technician assignments in their organization
CREATE POLICY "Users can insert job technician assignments in their organization"
ON job_technicians FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_technicians.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
);

-- Policy: Technicians can update their own assignments (accept/decline)
CREATE POLICY "Technicians can update their own assignments"
ON job_technicians FOR UPDATE
TO authenticated
USING (
    technician_id = auth.uid()
)
WITH CHECK (
    technician_id = auth.uid()
);

-- Policy: Managers can update any assignment in their organization
CREATE POLICY "Managers can update job technician assignments in their organization"
ON job_technicians FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_technicians.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_technicians.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
);

-- Policy: Managers can delete job_technician assignments
CREATE POLICY "Managers can delete job technician assignments in their organization"
ON job_technicians FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_technicians.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
);

-- ============================================================================
-- RLS POLICIES FOR JOB_EQUIPMENT
-- ============================================================================

ALTER TABLE job_equipment ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view job_equipment in their organization
CREATE POLICY "Users can view job equipment in their organization"
ON job_equipment FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_equipment.job_id
        AND u.id = auth.uid()
    )
);

-- Policy: Users can insert job_equipment in their organization
CREATE POLICY "Users can insert job equipment in their organization"
ON job_equipment FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_equipment.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher', 'technician')
    )
);

-- Policy: Users can update job_equipment in their organization
CREATE POLICY "Users can update job equipment in their organization"
ON job_equipment FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_equipment.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher', 'technician')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_equipment.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher', 'technician')
    )
);

-- Policy: Managers can delete job_equipment
CREATE POLICY "Managers can delete job equipment in their organization"
ON job_equipment FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM jobs j
        JOIN users u ON u.organization_id = j.organization_id
        WHERE j.id = job_equipment.job_id
        AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
);

-- ============================================================================
-- RLS POLICIES FOR NOTIFICATIONS
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (
    recipient_user_id = auth.uid()
);

-- Policy: System/managers can create notifications for users in their organization
CREATE POLICY "Managers can create notifications in their organization"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users u1
        JOIN users u2 ON u1.organization_id = u2.organization_id
        WHERE u1.id = auth.uid()
        AND u2.id = notifications.recipient_user_id
        AND u1.role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (
    recipient_user_id = auth.uid()
)
WITH CHECK (
    recipient_user_id = auth.uid()
);

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
TO authenticated
USING (
    recipient_user_id = auth.uid()
);
