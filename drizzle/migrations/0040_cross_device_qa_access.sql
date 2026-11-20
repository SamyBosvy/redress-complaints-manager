DROP POLICY "qa read" ON public.qa_reviews;
CREATE POLICY "qa read" ON public.qa_reviews FOR SELECT TO authenticated USING (
 public.has_org_role(org_id, ARRAY['org_admin'::public.app_role,'complaints_manager'::public.app_role,'qa_reviewer'::public.app_role,'read_only'::public.app_role])
 OR (public.has_org_role(org_id, ARRAY['agent'::public.app_role]) AND (
 EXISTS (SELECT 1 FROM public.letters l WHERE l.id=qa_reviews.letter_id AND l.org_id=qa_reviews.org_id AND l.sent_by=auth.uid())
 OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id=qa_reviews.complaint_id AND c.org_id=qa_reviews.org_id AND c.assigned_to=auth.uid())
 ))
);
DROP FUNCTION public.public_form_details(uuid);