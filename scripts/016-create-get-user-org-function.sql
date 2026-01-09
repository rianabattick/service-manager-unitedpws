-- Create function to get user's organization ID from auth context
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM users
  WHERE id = auth.uid()
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;
