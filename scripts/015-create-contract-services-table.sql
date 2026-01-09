-- Create contract_services table to track individual services (MJPM, MNPM) for contracts
-- This table links service agreements to specific service types with their frequency

CREATE TABLE IF NOT EXISTS public.contract_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.service_agreements(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('MJPM', 'MNPM')),
  frequency_months INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contract_services_contract_id ON public.contract_services(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_services_organization_id ON public.contract_services(organization_id);

-- Enable RLS
ALTER TABLE public.contract_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view contract services in their organization"
  ON public.contract_services
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create contract services in their organization"
  ON public.contract_services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update contract services in their organization"
  ON public.contract_services
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contract services in their organization"
  ON public.contract_services
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );
