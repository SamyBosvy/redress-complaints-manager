CREATE TABLE public.public_complaint_forms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL UNIQUE REFERENCES public.organisations(id),
 enabled boolean NOT NULL DEFAULT true, logo_path text, privacy_notice text NOT NULL DEFAULT 'We use the information you provide to investigate and respond to your complaint. Please do not include passwords, PINs or full card numbers. Contact the firm for its full privacy notice and information about your data protection rights.',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT privacy_length CHECK (length(privacy_notice) BETWEEN 1 AND 10000),
 CONSTRAINT logo_tenant_path CHECK (logo_path IS NULL OR logo_path LIKE org_id::text || '/%')
);
GRANT SELECT,INSERT,UPDATE ON public.public_complaint_forms TO authenticated;
GRANT ALL ON public.public_complaint_forms TO service_role;
ALTER TABLE public.public_complaint_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form admin read" ON public.public_complaint_forms FOR SELECT TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE POLICY "form admin insert" ON public.public_complaint_forms FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE POLICY "form admin update" ON public.public_complaint_forms FOR UPDATE TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[])) WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE TRIGGER public_forms_audit AFTER INSERT OR UPDATE OR DELETE ON public.public_complaint_forms FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
INSERT INTO public.public_complaint_forms(org_id) SELECT id FROM public.organisations;
CREATE TABLE public.public_form_submissions (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES public.organisations(id), complaint_id uuid NOT NULL REFERENCES public.complaints(id), privacy_notice text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_form_submissions TO authenticated;
GRANT ALL ON public.public_form_submissions TO service_role;
ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submission admin read" ON public.public_form_submissions FOR SELECT TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE TRIGGER public_submissions_audit AFTER INSERT OR UPDATE OR DELETE ON public.public_form_submissions FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE OR REPLACE FUNCTION public.public_form_details(_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',f.id,'firm_name',o.legal_name,'privacy_notice',f.privacy_notice,'logo_path',f.logo_path,'countries',COALESCE((SELECT jsonb_agg(country_code ORDER BY country_code) FROM public.org_countries WHERE org_id=o.id),'[]'::jsonb)) FROM public.public_complaint_forms f JOIN public.organisations o ON o.id=f.org_id WHERE f.id=_id AND f.enabled AND o.setup_complete;
$$;
REVOKE ALL ON FUNCTION public.public_form_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_form_details(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.is_public_firm_logo(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.public_complaint_forms f JOIN public.organisations o ON o.id=f.org_id WHERE f.logo_path=_path AND f.enabled AND o.setup_complete);
$$;
REVOKE ALL ON FUNCTION public.is_public_firm_logo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_firm_logo(text) TO anon,authenticated;
CREATE POLICY "published firm logo read" ON storage.objects FOR SELECT TO anon,authenticated USING (bucket_id='firm-logos' AND public.is_public_firm_logo(name));
CREATE POLICY "firm logo admin" ON storage.objects FOR ALL TO authenticated USING (bucket_id='firm-logos' AND public.has_org_role((storage.foldername(name))[1]::uuid,ARRAY['org_admin']::public.app_role[])) WITH CHECK (bucket_id='firm-logos' AND public.has_org_role((storage.foldername(name))[1]::uuid,ARRAY['org_admin']::public.app_role[]));
CREATE OR REPLACE FUNCTION public.submit_public_complaint(_form_id uuid,_submission_id uuid,_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.public_complaint_forms; c uuid; ref text; k text;
BEGIN
 SELECT forms.* INTO f FROM public.public_complaint_forms forms JOIN public.organisations o ON o.id=forms.org_id WHERE forms.id=_form_id AND forms.enabled AND o.setup_complete;
 IF f.id IS NULL THEN RAISE EXCEPTION 'This complaint form is unavailable'; END IF;
 IF _submission_id IS NULL OR jsonb_typeof(_data)<>'object' OR _data IS NULL THEN RAISE EXCEPTION 'Invalid submission'; END IF;
 IF COALESCE(_data->>'website','')<>'' OR _data->>'privacy_acknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Please acknowledge the privacy notice'; END IF;
 IF _data->>'privacy_notice' IS DISTINCT FROM f.privacy_notice THEN RAISE EXCEPTION 'The privacy notice has changed. Please refresh and review it before submitting.'; END IF;
 IF length(trim(COALESCE(_data->>'complainant_name',''))) NOT BETWEEN 1 AND 200 OR length(trim(COALESCE(_data->>'summary',''))) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Name and summary are required and must be within the permitted length'; END IF;
 IF length(COALESCE(_data->>'complainant_email',''))>255 OR (COALESCE(_data->>'complainant_email','')<>'' AND _data->>'complainant_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid email address'; END IF;
 IF length(COALESCE(_data->>'complainant_phone',''))>50 OR length(COALESCE(_data->>'customer_ref',''))>100 OR length(COALESCE(_data->>'desired_outcome',''))>5000 OR length(COALESCE(_data->>'vulnerable_note',''))>1000 THEN RAISE EXCEPTION 'A field exceeds the permitted length'; END IF;
 IF _data->>'language' IS NULL OR _data->>'language' NOT IN ('en','fr','es','pt','pl','nl') OR _data->>'vulnerable' IS NULL OR _data->>'vulnerable' NOT IN ('true','false') THEN RAISE EXCEPTION 'Invalid language or vulnerability flag'; END IF;
 IF _data->>'country_code' IS NULL OR NOT EXISTS(SELECT 1 FROM public.org_countries WHERE org_id=f.org_id AND country_code=_data->>'country_code') THEN RAISE EXCEPTION 'Select a country served by this firm'; END IF;
 IF _data->>'product' IS NULL OR _data->>'category' IS NULL THEN RAISE EXCEPTION 'Product and category are required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(_submission_id::text));
 SELECT complaints.reference INTO ref FROM public.public_form_submissions s JOIN public.complaints ON complaints.id=s.complaint_id WHERE s.id=_submission_id AND s.org_id=f.org_id;
 IF ref IS NOT NULL THEN RETURN ref; END IF;
 INSERT INTO public.complaints(org_id,channel,country_code,language,complainant_name,complainant_email,complainant_phone,customer_ref,product,category,summary,desired_outcome,vulnerable,vulnerable_note,status,priority,received_at,assigned_to,created_by)
 VALUES(f.org_id,'web_form',_data->>'country_code',_data->>'language',trim(_data->>'complainant_name'),nullif(trim(_data->>'complainant_email'),''),nullif(trim(_data->>'complainant_phone'),''),nullif(trim(_data->>'customer_ref'),''),(_data->>'product')::public.complaint_product,(_data->>'category')::public.complaint_category,trim(_data->>'summary'),nullif(trim(_data->>'desired_outcome'),''),(_data->>'vulnerable')::boolean,CASE WHEN (_data->>'vulnerable')::boolean THEN nullif(trim(_data->>'vulnerable_note'),'') END,'received','standard',now(),NULL,NULL) RETURNING id,reference INTO c,ref;
 INSERT INTO public.public_form_submissions(id,org_id,complaint_id,privacy_notice) VALUES(_submission_id,f.org_id,c,f.privacy_notice);
 RETURN ref;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_public_complaint(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_complaint(uuid,uuid,jsonb) TO anon,authenticated;
