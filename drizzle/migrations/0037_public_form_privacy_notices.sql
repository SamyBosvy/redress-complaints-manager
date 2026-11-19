CREATE TABLE public.public_form_privacy_notices (
 form_id uuid NOT NULL REFERENCES public.public_complaint_forms(id) ON DELETE CASCADE,
 org_id uuid NOT NULL REFERENCES public.organisations(id),
 language text NOT NULL CHECK(language IN ('en','fr','es','pt','pl','nl','de','it','lt','sv','da','cs','ro','ga')),
 body text NOT NULL CHECK(char_length(body) BETWEEN 50 AND 20000),
 updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(form_id,language)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.public_form_privacy_notices TO authenticated;
GRANT ALL ON public.public_form_privacy_notices TO service_role;
REVOKE ALL ON public.public_form_privacy_notices FROM anon;
ALTER TABLE public.public_form_privacy_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY notices_read ON public.public_form_privacy_notices FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE POLICY notices_insert ON public.public_form_privacy_notices FOR INSERT TO authenticated WITH CHECK(public.has_org_role(org_id,ARRAY['org_admin']::public.app_role[]));
CREATE POLICY notices_update ON public.public_form_privacy_notices FOR UPDATE TO authenticated USING(public.has_org_role(org_id,ARRAY['org_admin']::public.app_role[])) WITH CHECK(public.has_org_role(org_id,ARRAY['org_admin']::public.app_role[]));
CREATE POLICY notices_delete ON public.public_form_privacy_notices FOR DELETE TO authenticated USING(public.has_org_role(org_id,ARRAY['org_admin']::public.app_role[]));
CREATE FUNCTION public.public_notice_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.form_id IS DISTINCT FROM OLD.form_id OR NEW.language IS DISTINCT FROM OLD.language) THEN RAISE EXCEPTION 'Notice identity cannot change'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.public_complaint_forms WHERE id=NEW.form_id AND org_id=NEW.org_id) THEN RAISE EXCEPTION 'Form must belong to the same organisation'; END IF;
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER notice_guard BEFORE INSERT OR UPDATE ON public.public_form_privacy_notices FOR EACH ROW EXECUTE FUNCTION public.public_notice_guard();
CREATE TRIGGER notices_audit AFTER INSERT OR UPDATE OR DELETE ON public.public_form_privacy_notices FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
ALTER TABLE public.public_form_submissions ADD COLUMN privacy_notice_language text, ADD COLUMN privacy_notice_sha256 text;
CREATE OR REPLACE FUNCTION public.public_form_details(_id uuid,_language text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',f.id,'firm_name',o.legal_name,'privacy_notice',coalesce(n.body,f.privacy_notice),'notice_language',n.language,'privacy_notice_sha256',encode(extensions.digest(coalesce(n.body,f.privacy_notice),'sha256'),'hex'),'available_languages',coalesce((SELECT jsonb_agg(language ORDER BY language) FROM public.public_form_privacy_notices WHERE form_id=f.id AND org_id=f.org_id),'[]'::jsonb),'logo_path',f.logo_path,'countries',COALESCE((SELECT jsonb_agg(country_code ORDER BY country_code) FROM public.org_countries WHERE org_id=o.id),'[]'::jsonb)) FROM public.public_complaint_forms f JOIN public.organisations o ON o.id=f.org_id LEFT JOIN public.public_form_privacy_notices n ON n.form_id=f.id AND n.org_id=f.org_id AND n.language=_language WHERE f.id=_id AND f.enabled AND o.setup_complete;
$$;
REVOKE ALL ON FUNCTION public.public_form_details(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_form_details(uuid,text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.public_form_details(_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.public_form_details(_id,NULL); $$;
CREATE FUNCTION public.public_form_notice_receipt(_org uuid,_case uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('privacy_notice_language',s.privacy_notice_language) FROM public.public_form_submissions s WHERE s.org_id=_org AND s.complaint_id=_case AND public.can_read_mention_case(_org,_case,auth.uid());
$$;
REVOKE ALL ON FUNCTION public.public_form_notice_receipt(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.public_form_notice_receipt(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_public_complaint(_form_id uuid, _submission_id uuid, _data jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f public.public_complaint_forms; c uuid; ref text; k text; notice text; notice_lang text; requested text;
BEGIN
 SELECT forms.* INTO f FROM public.public_complaint_forms forms JOIN public.organisations o ON o.id=forms.org_id WHERE forms.id=_form_id AND forms.enabled AND o.setup_complete;
 IF f.id IS NULL THEN RAISE EXCEPTION 'This complaint form is unavailable'; END IF;
 IF _submission_id IS NULL OR jsonb_typeof(_data)<>'object' OR _data IS NULL THEN RAISE EXCEPTION 'Invalid submission'; END IF;
 IF COALESCE(_data->>'website','')<>'' OR _data->>'privacy_acknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Please acknowledge the privacy notice'; END IF;

 IF length(trim(COALESCE(_data->>'complainant_name',''))) NOT BETWEEN 1 AND 200 OR length(trim(COALESCE(_data->>'summary',''))) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Name and summary are required and must be within the permitted length'; END IF;
 IF length(COALESCE(_data->>'complainant_email',''))>255 OR (COALESCE(_data->>'complainant_email','')<>'' AND _data->>'complainant_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid email address'; END IF;
 IF length(COALESCE(_data->>'complainant_phone',''))>50 OR length(COALESCE(_data->>'customer_ref',''))>100 OR length(COALESCE(_data->>'desired_outcome',''))>5000 OR length(COALESCE(_data->>'vulnerable_note',''))>1000 THEN RAISE EXCEPTION 'A field exceeds the permitted length'; END IF;
 IF _data->>'language' IS NULL OR _data->>'language' NOT IN ('en','fr','es','pt','pl','nl','de','it','lt','sv','da','cs','ro','ga') OR _data->>'vulnerable' IS NULL OR _data->>'vulnerable' NOT IN ('true','false') THEN RAISE EXCEPTION 'Invalid language or vulnerability flag'; END IF;
 IF _data->>'country_code' IS NULL OR NOT EXISTS(SELECT 1 FROM public.org_countries WHERE org_id=f.org_id AND country_code=_data->>'country_code') THEN RAISE EXCEPTION 'Select a country served by this firm'; END IF;
 IF _data->>'product' IS NULL OR _data->>'category' IS NULL THEN RAISE EXCEPTION 'Product and category are required'; END IF;
 requested:=coalesce(_data->>'form_language',_data->>'language');
 IF requested NOT IN ('en','fr','es','pt','pl','nl','de','it','lt','sv','da','cs','ro','ga') THEN RAISE EXCEPTION 'Invalid form language'; END IF;
 SELECT body,language INTO notice,notice_lang FROM public.public_form_privacy_notices WHERE form_id=f.id AND org_id=f.org_id AND language=requested;
 notice:=coalesce(notice,f.privacy_notice);
 IF _data ? 'privacy_notice_sha256' AND _data->>'privacy_notice_sha256' IS DISTINCT FROM encode(extensions.digest(notice,'sha256'),'hex') THEN RAISE EXCEPTION 'The privacy notice has changed. Please refresh and review it before submitting.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(_submission_id::text));
 SELECT complaints.reference INTO ref FROM public.public_form_submissions s JOIN public.complaints ON complaints.id=s.complaint_id WHERE s.id=_submission_id AND s.org_id=f.org_id;
 IF ref IS NOT NULL THEN RETURN ref; END IF;
 INSERT INTO public.complaints(org_id,channel,country_code,language,complainant_name,complainant_email,complainant_phone,customer_ref,product,category,summary,desired_outcome,vulnerable,vulnerable_note,status,priority,received_at,assigned_to,created_by)
 VALUES(f.org_id,'web_form',_data->>'country_code',_data->>'language',trim(_data->>'complainant_name'),nullif(trim(_data->>'complainant_email'),''),nullif(trim(_data->>'complainant_phone'),''),nullif(trim(_data->>'customer_ref'),''),(_data->>'product')::public.complaint_product,(_data->>'category')::public.complaint_category,trim(_data->>'summary'),nullif(trim(_data->>'desired_outcome'),''),(_data->>'vulnerable')::boolean,NULL,'received','standard',now(),NULL,NULL) RETURNING id,reference INTO c,ref;
 INSERT INTO public.public_form_submissions(id,org_id,complaint_id,privacy_notice,privacy_notice_language,privacy_notice_sha256) VALUES(_submission_id,f.org_id,c,notice,notice_lang,encode(extensions.digest(notice,'sha256'),'hex'));
 IF (_data->>'vulnerable')::boolean THEN IF coalesce(_data->>'customer_consented','false') NOT IN ('true','false') OR jsonb_typeof(coalesce(_data->'adjustments','[]'::jsonb))<>'array' OR length(coalesce(_data->>'adjustments_note',''))>500 OR _data ? 'drivers' THEN RAISE EXCEPTION 'Invalid support needs'; END IF; UPDATE public.complaint_vulnerability SET adjustments=ARRAY(SELECT jsonb_array_elements_text(coalesce(_data->'adjustments','[]'::jsonb))),adjustments_note=nullif(trim(_data->>'adjustments_note'),''),customer_consented=coalesce((_data->>'customer_consented')::boolean,false),source='customer',assessed_by=NULL WHERE complaint_id=c AND org_id=f.org_id; END IF;
 RETURN ref;
END;
$function$