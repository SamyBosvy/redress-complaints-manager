CREATE OR REPLACE VIEW public.complaint_queue WITH (security_invoker=true) AS SELECT c.id,c.org_id,c.reference,c.seq,c.received_at,c.channel,c.country_code,c.language,c.complainant_name,c.complainant_email,c.complainant_phone,c.customer_ref,c.vulnerable,c.vulnerable_note,c.product,c.category,c.summary,c.desired_outcome,c.assigned_to,c.priority,c.status,c.outcome,c.redress_amount,c.redress_currency,c.goodwill_amount,c.goodwill_currency,c.root_cause_category,c.root_cause_note,c.rule_set_id,c.ack_due,c.final_due,c.extended_due,c.holding_sent_at,c.holding_reason,c.closed_at,c.created_by,c.created_at,c.updated_at,CASE WHEN holding_sent_at IS NOT NULL THEN extended_due ELSE final_due END AS current_due,public.business_days_between(org_id,country_code,CURRENT_DATE,CASE WHEN holding_sent_at IS NOT NULL THEN extended_due ELSE final_due END) AS days_left,c.anonymised_at,c.legal_hold FROM public.complaints c;
CREATE OR REPLACE FUNCTION public.privacy_audit_actor_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$ BEGIN IF NEW.action='retention_anonymisation' THEN NEW.actor:=NULL; END IF; RETURN NEW; END $fn$;
CREATE TRIGGER privacy_audit_actor_guard BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.privacy_audit_actor_guard();
CREATE OR REPLACE FUNCTION public.privacy_retention_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$ BEGIN IF NEW.retention_years NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Retention must be between 1 and 50 years'; END IF; RETURN NEW; END $fn$;
CREATE TRIGGER privacy_retention_guard BEFORE INSERT OR UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.privacy_retention_guard();
CREATE OR REPLACE FUNCTION public.privacy_purge_org(_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 PERFORM 1 FROM public.organisations WHERE id=_org FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.org_privacy_settings WHERE org_id=_org AND deletion_due_at<=now() AND billing_cancellation_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Deletion is not due or cancellation is unverified'; END IF;
 IF EXISTS(SELECT 1 FROM public.complaints WHERE org_id=_org AND legal_hold) THEN RAISE EXCEPTION 'Legal hold prevents deletion'; END IF;
 DELETE FROM public.notifications WHERE org_id=_org;
 DELETE FROM public.qa_reviews WHERE org_id=_org;
 DELETE FROM public.public_form_submissions WHERE org_id=_org;
 DELETE FROM public.public_complaint_forms WHERE org_id=_org;
 DELETE FROM public.complaints WHERE org_id=_org;
 DELETE FROM public.org_privacy_settings WHERE org_id=_org;
 DELETE FROM public.organisations WHERE id=_org;
END $fn$;
REVOKE ALL ON FUNCTION public.privacy_purge_org(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_purge_org(uuid) TO service_role;