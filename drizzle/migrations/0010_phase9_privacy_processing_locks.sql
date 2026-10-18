ALTER TABLE public.complaints ADD COLUMN privacy_processing boolean NOT NULL DEFAULT false;
CREATE TABLE public.privacy_operations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL,actor uuid,complaint_id uuid,kind text NOT NULL,detail jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.privacy_operations TO authenticated;
GRANT ALL ON public.privacy_operations TO service_role;
ALTER TABLE public.privacy_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "privacy operations admin read" ON public.privacy_operations FOR SELECT TO authenticated USING(public.has_org_role(org_id,ARRAY['org_admin']::public.app_role[]));
CREATE TRIGGER privacy_operations_audit AFTER INSERT OR UPDATE OR DELETE ON public.privacy_operations FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE OR REPLACE FUNCTION public.privacy_audit_actor_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$ BEGIN IF NEW.table_name='privacy_operations' THEN NEW.actor:=COALESCE(NEW.after->>'actor',NEW.before->>'actor')::uuid; END IF; RETURN NEW; END $fn$;
CREATE OR REPLACE FUNCTION public.privacy_case_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
  IF NEW.legal_hold IS DISTINCT FROM OLD.legal_hold OR NEW.anonymised_at IS DISTINCT FROM OLD.anonymised_at OR NEW.privacy_processing IS DISTINCT FROM OLD.privacy_processing THEN RAISE EXCEPTION 'Use the authorised privacy controls'; END IF;
 END IF;
 IF OLD.anonymised_at IS NOT NULL THEN RAISE EXCEPTION 'Anonymised records are read-only'; END IF;
 IF OLD.privacy_processing AND current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Privacy processing is in progress'; END IF;
 RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION public.privacy_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.complaints WHERE id=NEW.complaint_id AND (anonymised_at IS NOT NULL OR privacy_processing)) THEN RAISE EXCEPTION 'This complaint is read-only'; END IF;
 RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION public.privacy_claim_case(_org uuid,_case uuid,_retention boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE c public.complaints; years integer;
BEGIN
 SELECT * INTO c FROM public.complaints WHERE id=_case AND org_id=_org FOR UPDATE;
 IF c.id IS NULL OR c.status<>'closed' OR c.closed_at IS NULL OR c.legal_hold OR c.anonymised_at IS NOT NULL THEN RAISE EXCEPTION 'Complaint is not eligible'; END IF;
 SELECT retention_years INTO years FROM public.organisations WHERE id=_org;
 IF _retention AND c.closed_at+make_interval(years=>years)>now() THEN RAISE EXCEPTION 'Retention has not elapsed'; END IF;
 UPDATE public.complaints SET privacy_processing=true WHERE id=_case AND org_id=_org;
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_claim_case(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_claim_case(uuid,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.privacy_anonymise_case(_org uuid,_case uuid,_reason text,_actor uuid,_retention boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE c public.complaints; years integer;
BEGIN
 SELECT * INTO c FROM public.complaints WHERE id=_case AND org_id=_org FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Complaint not found'; END IF;
 IF c.anonymised_at IS NOT NULL THEN RETURN; END IF;
 IF c.closed_at IS NULL OR c.status<>'closed' OR c.legal_hold OR NOT c.privacy_processing THEN RAISE EXCEPTION 'Complaint must be claimed and eligible'; END IF;
 SELECT retention_years INTO years FROM public.organisations WHERE id=_org;
 IF _retention AND c.closed_at+make_interval(years=>years)>now() THEN RAISE EXCEPTION 'Retention has not elapsed'; END IF;
 IF length(trim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'A lawful basis is required'; END IF;
 DELETE FROM public.letters WHERE complaint_id=_case AND org_id=_org;
 DELETE FROM public.complaint_events WHERE complaint_id=_case AND org_id=_org AND kind IN ('note','attachment');
 UPDATE public.complaint_events SET detail=detail-'reason' WHERE complaint_id=_case AND org_id=_org;
 UPDATE public.qa_reviews SET comments=NULL,scorecard='{}'::jsonb WHERE complaint_id=_case AND org_id=_org;
 DELETE FROM public.notifications WHERE complaint_id=_case AND org_id=_org;
 UPDATE public.complaints SET complainant_name='Anonymised complainant',complainant_email=NULL,complainant_phone=NULL,customer_ref=NULL,vulnerable_note=NULL,summary='Personal data removed',desired_outcome=NULL,holding_reason=NULL,root_cause_note=NULL,root_cause_category=NULL,anonymised_at=now(),privacy_processing=false WHERE id=_case AND org_id=_org;
 INSERT INTO public.privacy_operations(org_id,actor,complaint_id,kind,detail) VALUES(_org,CASE WHEN _retention THEN NULL ELSE _actor END,_case,CASE WHEN _retention THEN 'retention_anonymisation' ELSE 'working_record_erasure' END,jsonb_build_object('reason',_reason,'historical_audit_retained',true));
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_anonymise_case(uuid,uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_anonymise_case(uuid,uuid,text,uuid,boolean) TO service_role;
CREATE POLICY "attachments deny privacy processing" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'attachments' OR NOT EXISTS(SELECT 1 FROM public.complaints WHERE id::text=split_part(name,'/',2) AND privacy_processing));