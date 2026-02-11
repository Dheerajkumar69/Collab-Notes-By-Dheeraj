-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view all groups
CREATE POLICY "Admins can view all groups"
ON public.groups
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view all notes
CREATE POLICY "Admins can view all notes"
ON public.notes
FOR SELECT
USING (has_role(auth.uid(), 'admin'));