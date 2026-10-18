ALTER TABLE public.complaints ADD COLUMN anonymised_at timestamptz, ADD COLUMN legal_hold boolean NOT NULL DEFAULT false;
CREATE TABLE public.org_privacy_settings (
 org_id uuid PRIMARY KEY REFERENCES public.organisations(id),
 deletion_requested_at timestamptz,
 deletion_due_at timestamptz,
 billing_cancellation_verified_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_privacy_settings TO authenticated;
GRANT ALL ON public.org_privacy_settings TO service_role;
ALTER TABLE public.org_privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "privacy admins read" ON public.org_privacy_settings FOR SELECT TO authenticated USING(public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE TRIGGER privacy_settings_audit AFTER INSERT OR UPDATE OR DELETE ON public.org_privacy_settings FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE OR REPLACE FUNCTION public.audit_minimise(_table text, _row jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $fn$
 SELECT CASE
 WHEN _row IS NULL THEN NULL
 WHEN _table='complaints' THEN _row - ARRAY['complainant_name','complainant_email','complainant_phone','customer_ref','vulnerable_note','summary','desired_outcome','holding_reason','root_cause_note','root_cause_category']
 WHEN _table='complaint_events' THEN _row - 'detail'
 WHEN _table='letters' THEN _row - ARRAY['subject','body']
 WHEN _table='qa_reviews' THEN _row - ARRAY['comments','scorecard']
 WHEN _table='notifications' THEN _row - 'title'
 WHEN _table='public_form_submissions' THEN _row - 'privacy_notice'
 ELSE _row END
$fn$;
CREATE OR REPLACE FUNCTION public.audit_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE o jsonb; n jsonb; org uuid; rid text;
BEGIN
 IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
 IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
 IF TG_OP='UPDATE' AND o=n THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='organisations' THEN org:=COALESCE(n->>'id',o->>'id')::uuid; ELSE org:=COALESCE(n->>'org_id',o->>'org_id')::uuid; END IF;
 rid:=COALESCE(n->>'id',o->>'id',n->>'org_id',o->>'org_id');
 INSERT INTO public.audit_log(org_id,actor,table_name,row_id,action,before,after) VALUES(org,auth.uid(),TG_TABLE_NAME,rid,lower(TG_OP),public.audit_minimise(TG_TABLE_NAME,o),public.audit_minimise(TG_TABLE_NAME,n));
 RETURN COALESCE(NEW,OLD);
END $fn$;
CREATE OR REPLACE FUNCTION public.privacy_case_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
  IF TG_OP='UPDATE' AND (NEW.legal_hold IS DISTINCT FROM OLD.legal_hold OR NEW.anonymised_at IS DISTINCT FROM OLD.anonymised_at) THEN RAISE EXCEPTION 'Use the authorised privacy controls'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.anonymised_at IS NOT NULL THEN RAISE EXCEPTION 'Anonymised records are read-only'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER privacy_case_guard BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.privacy_case_guard();
CREATE OR REPLACE FUNCTION public.privacy_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.complaints WHERE id=NEW.complaint_id AND anonymised_at IS NOT NULL) THEN RAISE EXCEPTION 'Anonymised records are read-only'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER privacy_event_guard BEFORE INSERT ON public.complaint_events FOR EACH ROW EXECUTE FUNCTION public.privacy_child_guard();
CREATE TRIGGER privacy_letter_guard BEFORE INSERT ON public.letters FOR EACH ROW EXECUTE FUNCTION public.privacy_child_guard();
CREATE OR REPLACE FUNCTION public.privacy_anonymise_case(_org uuid, _case uuid, _reason text, _actor uuid, _retention boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE c public.complaints; years integer;
BEGIN
 SELECT * INTO c FROM public.complaints WHERE id=_case AND org_id=_org FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Complaint not found'; END IF;
 IF c.anonymised_at IS NOT NULL THEN RETURN; END IF;
 IF c.closed_at IS NULL OR c.status <> 'closed' OR c.legal_hold THEN RAISE EXCEPTION 'Only closed complaints without a legal hold can be anonymised'; END IF;
 SELECT retention_years INTO years FROM public.organisations WHERE id=_org;
 IF _retention AND c.closed_at + make_interval(years=>years) > now() THEN RAISE EXCEPTION 'Retention period has not elapsed'; END IF;
 IF length(trim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'A lawful basis is required'; END IF;
 DELETE FROM public.letters WHERE complaint_id=_case AND org_id=_org;
 DELETE FROM public.complaint_events WHERE complaint_id=_case AND org_id=_org AND kind IN ('note','attachment');
 UPDATE public.complaint_events SET detail=detail - 'reason' WHERE complaint_id=_case AND org_id=_org;
 UPDATE public.qa_reviews SET comments=NULL,scorecard='{}'::jsonb WHERE complaint_id=_case AND org_id=_org;
 DELETE FROM public.notifications WHERE complaint_id=_case AND org_id=_org;
 UPDATE public.complaints SET complainant_name='Anonymised complainant',complainant_email=NULL,complainant_phone=NULL,customer_ref=NULL,vulnerable_note=NULL,summary='Personal data removed',desired_outcome=NULL,holding_reason=NULL,root_cause_note=NULL,root_cause_category=NULL,anonymised_at=now() WHERE id=_case AND org_id=_org;
 INSERT INTO public.audit_log(org_id,actor,table_name,row_id,action,after) VALUES(_org,_actor,'privacy',_case::text,CASE WHEN _retention THEN 'retention_anonymisation' ELSE 'working_record_erasure' END,jsonb_build_object('reason',_reason,'historical_audit_retained',true));
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_anonymise_case(uuid,uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_anonymise_case(uuid,uuid,text,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.privacy_set_retention(_org uuid,_years integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF NOT public.has_org_role(_org,ARRAY['org_admin']::public.app_role[]) THEN RAISE EXCEPTION 'Only Org Admins can change retention'; END IF;
 IF _years NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Choose a retention period between 1 and 50 years'; END IF;
 UPDATE public.organisations SET retention_years=_years WHERE id=_org;
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_set_retention(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.privacy_set_retention(uuid,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.privacy_request_org_deletion(_org uuid,_confirm text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE o public.organisations; verified timestamptz;
BEGIN
 IF NOT public.has_org_role(_org,ARRAY['org_admin']::public.app_role[]) THEN RAISE EXCEPTION 'Only Org Admins can request deletion'; END IF;
 SELECT * INTO o FROM public.organisations WHERE id=_org FOR UPDATE;
 IF _confirm IS DISTINCT FROM o.legal_name THEN RAISE EXCEPTION 'Enter the exact legal entity name'; END IF;
 SELECT billing_cancellation_verified_at INTO verified FROM public.org_privacy_settings WHERE org_id=_org;
 IF verified IS NULL THEN RAISE EXCEPTION 'Billing cancellation must be verified before organisation deletion can be scheduled'; END IF;
 IF EXISTS(SELECT 1 FROM public.complaints WHERE org_id=_org AND legal_hold) THEN RAISE EXCEPTION 'Release legal holds after legal review before requesting deletion'; END IF;
 INSERT INTO public.org_privacy_settings(org_id,deletion_requested_at,deletion_due_at) VALUES(_org,now(),now()+interval '30 days') ON CONFLICT(org_id) DO UPDATE SET deletion_requested_at=COALESCE(org_privacy_settings.deletion_requested_at,EXCLUDED.deletion_requested_at),deletion_due_at=COALESCE(org_privacy_settings.deletion_due_at,EXCLUDED.deletion_due_at),updated_at=now();
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_request_org_deletion(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.privacy_request_org_deletion(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.privacy_cancel_org_deletion(_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF NOT public.has_org_role(_org,ARRAY['org_admin']::public.app_role[]) THEN RAISE EXCEPTION 'Only Org Admins can cancel deletion'; END IF;
 UPDATE public.org_privacy_settings SET deletion_requested_at=NULL,deletion_due_at=NULL,updated_at=now() WHERE org_id=_org;
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_cancel_org_deletion(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.privacy_cancel_org_deletion(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.privacy_purge_org(_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 PERFORM 1 FROM public.organisations WHERE id=_org FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.org_privacy_settings WHERE org_id=_org AND deletion_due_at<=now() AND billing_cancellation_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Deletion is not due or cancellation is unverified'; END IF;
 IF EXISTS(SELECT 1 FROM public.complaints WHERE org_id=_org AND legal_hold) THEN RAISE EXCEPTION 'Legal hold prevents deletion'; END IF;
 DELETE FROM public.notifications WHERE org_id=_org;
 DELETE FROM public.qa_reviews WHERE org_id=_org;
 DELETE FROM public.public_form_submissions WHERE org_id=_org;
 DELETE FROM public.public_complaint_forms WHERE org_id=_org;
 DELETE FROM public.org_privacy_settings WHERE org_id=_org;
 DELETE FROM public.organisations WHERE id=_org;
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_purge_org(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_purge_org(uuid) TO service_role;
CREATE POLICY "attachments deny anonymised insert" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (bucket_id <> 'attachments' OR NOT EXISTS(SELECT 1 FROM public.complaints WHERE id::text=split_part(name,'/',2) AND anonymised_at IS NOT NULL));