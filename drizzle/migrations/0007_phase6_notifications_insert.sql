GRANT INSERT ON public.notifications TO authenticated;
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (is_org_member(org_id));