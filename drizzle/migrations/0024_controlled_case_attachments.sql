CREATE TYPE public.attachment_category AS ENUM ('customer_evidence','firm_document','correspondence','other');
CREATE TABLE public.complaint_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organisations(id), complaint_id uuid NOT NULL REFERENCES public.complaints(id), storage_path text NOT NULL UNIQUE, file_name text NOT NULL, mime_type text NOT NULL, size_bytes bigint NOT NULL DEFAULT 0 CHECK(size_bytes>=0), sha256 text CHECK(sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'), category public.attachment_category NOT NULL DEFAULT 'other', description text CHECK(length(description)<=500), uploaded_by uuid, uploaded_at timestamptz NOT NULL DEFAULT now(), removed_at timestamptz, removed_by uuid, removal_reason text,
 CHECK((removed_at IS NULL AND removed_by IS NULL AND removal_reason IS NULL) OR (removed_at IS NOT NULL AND length(trim(removal_reason)) BETWEEN 5 AND 500))
);
GRANT SELECT,INSERT,UPDATE ON public.complaint_attachments TO authenticated;
GRANT ALL ON public.complaint_attachments TO service_role;
ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attachment_read ON public.complaint_attachments FOR SELECT TO authenticated USING (
 (removed_at IS NULL OR public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[])) AND
 (public.has_org_role(org_id,ARRAY['org_admin','complaints_manager','qa_reviewer','read_only']::public.app_role[]) OR (public.has_org_role(org_id,ARRAY['agent']::public.app_role[]) AND EXISTS(SELECT 1 FROM public.complaints c WHERE c.id=complaint_id AND c.org_id=complaint_attachments.org_id AND c.assigned_to=auth.uid())))
);
CREATE POLICY attachment_insert ON public.complaint_attachments FOR INSERT TO authenticated WITH CHECK (
 public.has_org_role(org_id,ARRAY['org_admin','complaints_manager','qa_reviewer']::public.app_role[]) OR (public.has_org_role(org_id,ARRAY['agent']::public.app_role[]) AND EXISTS(SELECT 1 FROM public.complaints c WHERE c.id=complaint_id AND c.org_id=complaint_attachments.org_id AND c.assigned_to=auth.uid()))
);
CREATE POLICY attachment_remove ON public.complaint_attachments FOR UPDATE TO authenticated USING (
 removed_at IS NULL AND (public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) OR (uploaded_by=auth.uid() AND uploaded_at>=now()-interval '15 minutes' AND public.has_org_role(org_id,ARRAY['qa_reviewer','agent']::public.app_role[])))
) WITH CHECK (public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) OR (uploaded_by=auth.uid() AND uploaded_at>=now()-interval '15 minutes' AND public.has_org_role(org_id,ARRAY['qa_reviewer','agent']::public.app_role[])));
INSERT INTO public.complaint_attachments(id,org_id,complaint_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,uploaded_at)
SELECT DISTINCT ON(e.detail->>'path') e.id,e.org_id,e.complaint_id,e.detail->>'path',coalesce(nullif(e.detail->>'name',''),split_part(e.detail->>'path','/',3),'Attachment'),
 CASE lower(regexp_replace(coalesce(e.detail->>'name',e.detail->>'path'),'^.*\.','')) WHEN 'pdf' THEN 'application/pdf' WHEN 'png' THEN 'image/png' WHEN 'jpg' THEN 'image/jpeg' WHEN 'jpeg' THEN 'image/jpeg' WHEN 'webp' THEN 'image/webp' WHEN 'heic' THEN 'image/heic' WHEN 'txt' THEN 'text/plain' WHEN 'csv' THEN 'text/csv' WHEN 'eml' THEN 'message/rfc822' WHEN 'msg' THEN 'application/vnd.ms-outlook' WHEN 'docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' WHEN 'xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ELSE 'application/octet-stream' END,
 CASE WHEN coalesce(e.detail->>'size','') ~ '^[0-9]{1,15}$' THEN (e.detail->>'size')::bigint ELSE 0 END,e.actor,e.created_at
FROM public.complaint_events e JOIN public.complaints c ON c.id=e.complaint_id AND c.org_id=e.org_id WHERE e.kind='attachment' AND nullif(e.detail->>'path','') IS NOT NULL ORDER BY e.detail->>'path',e.created_at,e.id;
CREATE FUNCTION public.attachment_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c public.complaints;
BEGIN
 SELECT * INTO c FROM public.complaints WHERE id=NEW.complaint_id AND org_id=NEW.org_id FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Complaint not found in this organisation'; END IF;
 IF TG_OP='UPDATE' AND current_user NOT IN ('authenticated','anon') AND (c.privacy_processing OR c.anonymised_at IS NOT NULL) AND NEW.file_name='removed' AND NEW.description IS NULL THEN RETURN NEW; END IF;
 IF c.anonymised_at IS NOT NULL OR c.privacy_processing THEN RAISE EXCEPTION 'This complaint is read-only'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.storage_path !~ ('^'||NEW.org_id::text||'/'||NEW.complaint_id::text||'/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[^/]+$') THEN RAISE EXCEPTION 'Invalid attachment path'; END IF;
  IF NEW.size_bytes>20971520 OR NEW.mime_type NOT IN ('application/pdf','image/png','image/jpeg','image/webp','image/heic','text/plain','text/csv','message/rfc822','application/vnd.ms-outlook','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') THEN RAISE EXCEPTION 'Unsupported file type or file exceeds 20 MB'; END IF;
  NEW.uploaded_by:=auth.uid(); NEW.uploaded_at:=now(); NEW.removed_at:=NULL;NEW.removed_by:=NULL;NEW.removal_reason:=NULL;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['removed_at','removed_by','removal_reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['removed_at','removed_by','removal_reason']) THEN RAISE EXCEPTION 'Attachment metadata cannot be changed'; END IF;
  IF c.legal_hold THEN RAISE EXCEPTION 'Legal hold prevents attachment removal'; END IF;
  IF OLD.removed_at IS NOT NULL OR NEW.removed_at IS NULL OR length(trim(coalesce(NEW.removal_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Removal requires a reason of 5–500 characters'; END IF;
  IF NOT (public.has_org_role(OLD.org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) OR (OLD.uploaded_by=auth.uid() AND OLD.uploaded_at>=now()-interval '15 minutes' AND public.has_org_role(OLD.org_id,ARRAY['qa_reviewer','agent']::public.app_role[]))) THEN RAISE EXCEPTION 'Attachment removal is not permitted'; END IF;
  NEW.removed_at:=now();NEW.removed_by:=auth.uid();NEW.removal_reason:=trim(NEW.removal_reason);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attachment_guard BEFORE INSERT OR UPDATE ON public.complaint_attachments FOR EACH ROW EXECUTE FUNCTION public.attachment_guard();
CREATE FUNCTION public.attachment_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Attachments cannot be deleted; use reasoned removal'; END $$;
CREATE TRIGGER attachment_no_delete BEFORE DELETE ON public.complaint_attachments FOR EACH ROW EXECUTE FUNCTION public.attachment_no_delete();
CREATE TRIGGER attachment_no_truncate BEFORE TRUNCATE ON public.complaint_attachments FOR EACH STATEMENT EXECUTE FUNCTION public.attachment_no_delete();
CREATE FUNCTION public.attachment_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' OR (OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL) THEN INSERT INTO public.complaint_events(org_id,complaint_id,actor,kind,detail) VALUES(NEW.org_id,NEW.complaint_id,CASE WHEN TG_OP='INSERT' THEN NEW.uploaded_by ELSE NEW.removed_by END,CASE WHEN TG_OP='INSERT' THEN 'attachment' ELSE 'attachment_removed' END,jsonb_build_object('attachment_id',NEW.id,'path',NEW.storage_path)); END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.attachment_events() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER attachment_events AFTER INSERT OR UPDATE ON public.complaint_attachments FOR EACH ROW EXECUTE FUNCTION public.attachment_events();
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.audit_minimise(text,jsonb)'::regprocedure) INTO def; def:=replace(def,'ELSE _row END','WHEN _table=''complaint_attachments'' THEN _row-ARRAY[''file_name'',''description'',''removal_reason'',''storage_path''] ELSE _row END'); EXECUTE def; END $$;
CREATE TRIGGER attachment_audit AFTER INSERT OR UPDATE OR DELETE ON public.complaint_attachments FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE FUNCTION public.attachment_anonymise() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF OLD.anonymised_at IS NULL AND NEW.anonymised_at IS NOT NULL THEN UPDATE public.complaint_attachments SET file_name='removed',description=NULL,removal_reason=CASE WHEN removed_at IS NOT NULL THEN 'Privacy erasure' ELSE NULL END WHERE complaint_id=NEW.id AND org_id=NEW.org_id; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.attachment_anonymise() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER attachment_anonymise AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.attachment_anonymise();
CREATE INDEX attachment_case ON public.complaint_attachments(org_id,complaint_id,uploaded_at,id);
DROP POLICY "attachments read" ON storage.objects;
CREATE POLICY "attachments read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='attachments' AND EXISTS(SELECT 1 FROM public.complaint_attachments a JOIN public.complaints c ON c.id=a.complaint_id AND c.org_id=a.org_id WHERE a.storage_path=name AND a.removed_at IS NULL AND c.anonymised_at IS NULL AND NOT c.privacy_processing));
DROP POLICY "attachments upload" ON storage.objects;
CREATE POLICY "attachments upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='attachments' AND EXISTS(SELECT 1 FROM public.complaints c WHERE name ~ ('^'||c.org_id::text||'/'||c.id::text||'/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[^/]+$') AND c.anonymised_at IS NULL AND NOT c.privacy_processing AND (public.has_org_role(c.org_id,ARRAY['org_admin','complaints_manager','qa_reviewer']::public.app_role[]) OR (public.has_org_role(c.org_id,ARRAY['agent']::public.app_role[]) AND c.assigned_to=auth.uid()))));
NOTIFY pgrst,'reload schema';