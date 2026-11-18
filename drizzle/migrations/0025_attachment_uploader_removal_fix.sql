CREATE FUNCTION public.remove_complaint_attachment(_org uuid,_attachment uuid,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a public.complaint_attachments; c public.complaints; BEGIN
 SELECT * INTO a FROM public.complaint_attachments WHERE id=_attachment AND org_id=_org FOR UPDATE;
 IF a.id IS NULL OR a.removed_at IS NOT NULL THEN RAISE EXCEPTION 'Attachment not found or already removed'; END IF;
 SELECT * INTO c FROM public.complaints WHERE id=a.complaint_id AND org_id=a.org_id FOR UPDATE;
 IF c.id IS NULL OR c.anonymised_at IS NOT NULL OR c.privacy_processing OR c.legal_hold THEN RAISE EXCEPTION 'This complaint is locked'; END IF;
 IF NOT (public.has_org_role(_org,ARRAY['org_admin','complaints_manager']::public.app_role[]) OR (a.uploaded_by=auth.uid() AND a.uploaded_at>=now()-interval '15 minutes' AND (public.has_org_role(_org,ARRAY['qa_reviewer']::public.app_role[]) OR (public.has_org_role(_org,ARRAY['agent']::public.app_role[]) AND c.assigned_to=auth.uid())))) THEN RAISE EXCEPTION 'Attachment removal is not permitted'; END IF;
 IF length(trim(coalesce(_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Removal requires a reason of 5–500 characters'; END IF;
 UPDATE public.complaint_attachments SET removed_at=now(),removed_by=auth.uid(),removal_reason=trim(_reason) WHERE id=a.id AND org_id=_org;
 END $$;
REVOKE ALL ON FUNCTION public.remove_complaint_attachment(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_complaint_attachment(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';