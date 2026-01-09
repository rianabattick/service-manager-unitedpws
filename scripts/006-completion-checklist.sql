-- Create completion_checklists table to persist job completion status
CREATE TABLE IF NOT EXISTS completion_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reports_uploaded BOOLEAN DEFAULT FALSE,
  reports_sent_to_customer BOOLEAN DEFAULT FALSE,
  reports_saved_in_file BOOLEAN DEFAULT FALSE,
  invoiced BOOLEAN DEFAULT FALSE,
  no_pending_return_visits BOOLEAN DEFAULT FALSE,
  parts_logistics_completed BOOLEAN DEFAULT FALSE,
  previous_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

-- Add RLS policies
ALTER TABLE completion_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization checklists"
  ON completion_checklists
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage checklists"
  ON completion_checklists
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_completion_checklists_job_id ON completion_checklists(job_id);
CREATE INDEX IF NOT EXISTS idx_completion_checklists_org_id ON completion_checklists(organization_id);
