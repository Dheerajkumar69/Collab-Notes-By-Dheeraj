CREATE OR REPLACE FUNCTION public.is_group_accessible(gid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = gid
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR g.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM unnest(g.members) AS member_email(email)
          WHERE lower(member_email.email) = lower(coalesce(p.email, auth.jwt() ->> 'email', ''))
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_accessible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_accessible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_accessible(uuid) TO service_role;