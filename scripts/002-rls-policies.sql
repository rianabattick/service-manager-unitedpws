-- Service Manager 1.0 - Row Level Security (RLS) Policies
-- This script enables RLS and creates security policies for all tables

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_agreement_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Get current user's organization
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT organization_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

-- Users can view their own organization
CREATE POLICY "Users can view their organization"
ON organizations FOR SELECT
USING (id = get_user_organization_id());

-- Owners and admins can update their organization
CREATE POLICY "Owners and admins can update organization"
ON organizations FOR UPDATE
USING (
    id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.organization_id = organizations.id 
        AND users.role IN ('owner', 'admin')
    )
);

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

-- Users can view all users in their organization
CREATE POLICY "Users can view organization members"
ON users FOR SELECT
USING (organization_id = get_user_organization_id());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (id = auth.uid());

-- Owners and admins can insert new users
CREATE POLICY "Owners and admins can create users"
ON users FOR INSERT
WITH CHECK (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin')
    )
);

-- Owners and admins can update other users
CREATE POLICY "Owners and admins can update users"
ON users FOR UPDATE
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin')
    )
);

-- ============================================================================
-- CUSTOMERS POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization customers"
ON customers FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create customers"
ON customers FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update customers"
ON customers FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete customers"
ON customers FOR DELETE
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin')
    )
);

-- ============================================================================
-- SERVICE LOCATIONS POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization service locations"
ON service_locations FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create service locations"
ON service_locations FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update service locations"
ON service_locations FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete service locations"
ON service_locations FOR DELETE
USING (organization_id = get_user_organization_id());

-- ============================================================================
-- EQUIPMENT POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization equipment"
ON equipment FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create equipment"
ON equipment FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update equipment"
ON equipment FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete equipment"
ON equipment FOR DELETE
USING (organization_id = get_user_organization_id());

-- ============================================================================
-- JOBS POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization jobs"
ON jobs FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create jobs"
ON jobs FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update jobs"
ON jobs FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete jobs"
ON jobs FOR DELETE
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin', 'manager')
    )
);

-- ============================================================================
-- JOB TASKS POLICIES
-- ============================================================================

CREATE POLICY "Users can view job tasks"
ON job_tasks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_tasks.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can create job tasks"
ON job_tasks FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_tasks.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can update job tasks"
ON job_tasks FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_tasks.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can delete job tasks"
ON job_tasks FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_tasks.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

-- ============================================================================
-- JOB ATTACHMENTS POLICIES
-- ============================================================================

CREATE POLICY "Users can view job attachments"
ON job_attachments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_attachments.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can create job attachments"
ON job_attachments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_attachments.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can delete job attachments"
ON job_attachments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_attachments.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

-- ============================================================================
-- JOB STATUS HISTORY POLICIES
-- ============================================================================

CREATE POLICY "Users can view job status history"
ON job_status_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_status_history.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can create job status history"
ON job_status_history FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_status_history.job_id 
        AND jobs.organization_id = get_user_organization_id()
    )
);

-- ============================================================================
-- SCHEDULING POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization schedules"
ON technician_schedules FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Managers can manage schedules"
ON technician_schedules FOR ALL
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin', 'manager', 'dispatcher')
    )
);

CREATE POLICY "Users can view organization time off"
ON time_off FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Technicians can create time off requests"
ON time_off FOR INSERT
WITH CHECK (
    organization_id = get_user_organization_id() AND
    technician_id = auth.uid()
);

CREATE POLICY "Managers can manage time off"
ON time_off FOR UPDATE
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin', 'manager')
    )
);

-- ============================================================================
-- SERVICE ZONES POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization zones"
ON service_zones FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Managers can manage zones"
ON service_zones FOR ALL
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin', 'manager')
    )
);

CREATE POLICY "Users can view technician zones"
ON technician_zones FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = technician_zones.technician_id 
        AND users.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Managers can manage technician zones"
ON technician_zones FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.organization_id = get_user_organization_id()
        AND users.role IN ('owner', 'admin', 'manager')
    )
);

-- ============================================================================
-- INVENTORY POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization inventory"
ON inventory_items FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create inventory items"
ON inventory_items FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update inventory items"
ON inventory_items FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete inventory items"
ON inventory_items FOR DELETE
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Users can view inventory transactions"
ON inventory_transactions FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create inventory transactions"
ON inventory_transactions FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can view organization truck inventory"
ON truck_inventory FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Technicians can manage their truck inventory"
ON truck_inventory FOR ALL
USING (
    organization_id = get_user_organization_id() AND
    technician_id = auth.uid()
);

-- ============================================================================
-- INVOICES & PAYMENTS POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization invoices"
ON invoices FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create invoices"
ON invoices FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update invoices"
ON invoices FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can view invoice line items"
ON invoice_line_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM invoices 
        WHERE invoices.id = invoice_line_items.invoice_id 
        AND invoices.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can create invoice line items"
ON invoice_line_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM invoices 
        WHERE invoices.id = invoice_line_items.invoice_id 
        AND invoices.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can update invoice line items"
ON invoice_line_items FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM invoices 
        WHERE invoices.id = invoice_line_items.invoice_id 
        AND invoices.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can delete invoice line items"
ON invoice_line_items FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM invoices 
        WHERE invoices.id = invoice_line_items.invoice_id 
        AND invoices.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can view organization payments"
ON payments FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create payments"
ON payments FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update payments"
ON payments FOR UPDATE
USING (organization_id = get_user_organization_id());

-- ============================================================================
-- ESTIMATES POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization estimates"
ON estimates FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create estimates"
ON estimates FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update estimates"
ON estimates FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can view estimate line items"
ON estimate_line_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM estimates 
        WHERE estimates.id = estimate_line_items.estimate_id 
        AND estimates.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can create estimate line items"
ON estimate_line_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM estimates 
        WHERE estimates.id = estimate_line_items.estimate_id 
        AND estimates.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can update estimate line items"
ON estimate_line_items FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM estimates 
        WHERE estimates.id = estimate_line_items.estimate_id 
        AND estimates.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can delete estimate line items"
ON estimate_line_items FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM estimates 
        WHERE estimates.id = estimate_line_items.estimate_id 
        AND estimates.organization_id = get_user_organization_id()
    )
);

-- ============================================================================
-- COMMUNICATIONS POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization communications"
ON communications FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create communications"
ON communications FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- ============================================================================
-- SERVICE AGREEMENTS POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization service agreements"
ON service_agreements FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create service agreements"
ON service_agreements FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update service agreements"
ON service_agreements FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can view service agreement equipment"
ON service_agreement_equipment FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM service_agreements 
        WHERE service_agreements.id = service_agreement_equipment.agreement_id 
        AND service_agreements.organization_id = get_user_organization_id()
    )
);

CREATE POLICY "Users can manage service agreement equipment"
ON service_agreement_equipment FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM service_agreements 
        WHERE service_agreements.id = service_agreement_equipment.agreement_id 
        AND service_agreements.organization_id = get_user_organization_id()
    )
);

-- ============================================================================
-- TIME ENTRIES POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization time entries"
ON time_entries FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Technicians can create their own time entries"
ON time_entries FOR INSERT
WITH CHECK (
    organization_id = get_user_organization_id() AND
    technician_id = auth.uid()
);

CREATE POLICY "Technicians can update their own time entries"
ON time_entries FOR UPDATE
USING (
    organization_id = get_user_organization_id() AND
    technician_id = auth.uid()
);

CREATE POLICY "Managers can manage all time entries"
ON time_entries FOR ALL
USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('owner', 'admin', 'manager')
    )
);

-- ============================================================================
-- REVIEWS POLICIES
-- ============================================================================

CREATE POLICY "Users can view organization reviews"
ON reviews FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create reviews"
ON reviews FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update reviews"
ON reviews FOR UPDATE
USING (organization_id = get_user_organization_id());
