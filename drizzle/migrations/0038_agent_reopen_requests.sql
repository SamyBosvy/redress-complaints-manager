CREATE TABLE public.reopen_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organisations(id),complaint_id uuid NOT NULL REFERENCES public.complaints(id),requested_by uuid NOT NULL,
 category text NOT NULL CHECK(category IN ('new_evidence','customer_disagreed','handling_error','regulator_adr_request','other')),reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','withdrawn','expired')),decided_by uuid,decided_at timestamptz,decision_note text,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(decision_note IS NULL OR length(trim(decision_note)) BETWEEN 5 AND 1000),CHECK(status<>'rejected' OR decision_note IS NOT NULL)
);
GRANT SELECT ON public.reopen_requests TO authenticated;
GRANT ALL ON public.reopen_requests TO service_role;
REVOKE ALL ON public.reopen_requests FROM anon;
ALTER TABLE public.reopen_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY reopen_requests_read ON public.reopen_requests FOR SELECT TO authenticated USING(public.has_org_role(org_id,ARRAY['org_admin','complaints_manager','qa_reviewer','read_only']::public.app_role[]) OR (requested_by=auth.uid() AND public.has_org_role(org_id,ARRAY['agent']::public.app_role[])));
CREATE UNIQUE INDEX reopen_requests_pending ON public.reopen_requests(complaint_id) WHERE status='pending';
CREATE INDEX reopen_requests_org_status ON public.reopen_requests(org_id,status,created_at DESC);
CREATE INDEX reopen_requests_person ON public.reopen_requests(org_id,requested_by,created_at DESC);
CREATE FUNCTION public.reopen_request_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reopen requests cannot be deleted'; END IF;
 IF current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Use reopening request actions'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.complaints WHERE id=NEW.complaint_id AND org_id=NEW.org_id) THEN RAISE EXCEPTION 'Complaint belongs to another organisation'; END IF; RETURN NEW; END $$;
CREATE TRIGGER reopen_request_guard BEFORE INSERT OR UPDATE OR DELETE ON public.reopen_requests FOR EACH ROW EXECUTE FUNCTION public.reopen_request_guard();
CREATE TRIGGER reopen_requests_audit AFTER INSERT OR UPDATE OR DELETE ON public.reopen_requests FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
-- Preserve the existing RPC verbatim; permit its prefixed 2000-character request reason in the history record.
ALTER TABLE public.complaint_reopenings DROP CONSTRAINT complaint_reopenings_reason_check;
ALTER TABLE public.complaint_reopenings ADD CONSTRAINT complaint_reopenings_reason_check CHECK(length(trim(reason)) BETWEEN 10 AND 2200);
CREATE FUNCTION public.can_request_reopen(_org uuid,_case uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_org_role(_org,ARRAY['agent']::public.app_role[]) AND EXISTS(SELECT 1 FROM public.complaints c WHERE c.id=_case AND c.org_id=_org AND c.status IN ('closed','final_response_sent') AND NOT c.legal_hold AND NOT c.privacy_processing AND c.anonymised_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.adr_cases WHERE org_id=_org AND complaint_id=_case AND decision='pending') AND (c.assigned_to=auth.uid() OR EXISTS(SELECT 1 FROM public.audit_log a WHERE a.org_id=_org AND a.table_name='complaints' AND a.row_id=_case::text AND a.after->>'status'='closed' AND a.before->>'status' IS DISTINCT FROM 'closed' AND a.after->>'assigned_to'=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.audit_log later WHERE later.org_id=_org AND later.table_name='complaints' AND later.row_id=_case::text AND later.after->>'status'='closed' AND later.before->>'status' IS DISTINCT FROM 'closed' AND later.id>a.id)))) $$;
REVOKE ALL ON FUNCTION public.can_request_reopen(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_request_reopen(uuid,uuid) TO authenticated;
CREATE FUNCTION public.request_reopen(_org uuid,_case uuid,_category text,_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.complaints; rid uuid; BEGIN
 IF auth.uid() IS NULL OR NOT public.has_org_role(_org,ARRAY['agent']::public.app_role[]) THEN RAISE EXCEPTION 'Only active agents can request reopening'; END IF;
 SELECT * INTO c FROM public.complaints WHERE id=_case AND org_id=_org FOR UPDATE;
 IF c.id IS NULL OR c.status NOT IN ('closed','final_response_sent') OR c.legal_hold OR c.privacy_processing OR c.anonymised_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.adr_cases WHERE org_id=_org AND complaint_id=_case AND decision='pending') THEN RAISE EXCEPTION 'This complaint cannot be reopened'; END IF;
 IF NOT public.can_request_reopen(_org,_case) THEN RAISE EXCEPTION 'Only the current or closing assigned agent can request reopening'; END IF;
 INSERT INTO public.reopen_requests(org_id,complaint_id,requested_by,category,reason) VALUES(_org,_case,auth.uid(),_category,trim(_reason)) RETURNING id INTO rid;
 INSERT INTO public.complaint_events(org_id,complaint_id,actor,kind,detail) VALUES(_org,_case,auth.uid(),'reopen_requested',jsonb_build_object('request_id',rid,'text','Reopening requested: '||trim(_reason)));
 INSERT INTO public.notifications(org_id,user_id,kind,title,complaint_id,actor,dedupe_key) SELECT _org,m.user_id,'reopen_requested','Reopening requested: '||c.reference,_case,auth.uid(),'reopen_requested:'||rid::text FROM public.org_members m WHERE m.org_id=_org AND m.active AND m.role IN ('org_admin','complaints_manager') ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 RETURN rid; END $$;
CREATE FUNCTION public.decide_reopen_request(_request uuid,_decision text,_note text DEFAULT NULL,_mode text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.reopen_requests; who text; BEGIN
 SELECT * INTO r FROM public.reopen_requests WHERE id=_request;
 IF r.id IS NULL OR auth.uid() IS NULL OR NOT public.has_org_role(r.org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) THEN RAISE EXCEPTION 'Only managers and administrators can decide'; END IF;
 IF r.requested_by=auth.uid() THEN RAISE EXCEPTION 'You cannot decide your own request'; END IF;
 PERFORM 1 FROM public.complaints WHERE id=r.complaint_id AND org_id=r.org_id FOR UPDATE;
 SELECT * INTO r FROM public.reopen_requests WHERE id=_request FOR UPDATE;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
 IF _decision IS NULL OR _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF _decision='rejected' AND (_note IS NULL OR length(trim(_note)) NOT BETWEEN 5 AND 1000) THEN RAISE EXCEPTION 'A rejection note of 5–1000 characters is required'; END IF;
 IF _decision='approved' THEN
 SELECT left(coalesce(nullif(trim(full_name),''),'Agent'),150) INTO who FROM public.profiles WHERE id=r.requested_by;
 PERFORM public.reopen_complaint(r.org_id,r.complaint_id,r.category,'Requested by '||coalesce(who,'Agent')||': '||r.reason,_mode);
 END IF;
 UPDATE public.reopen_requests SET status=_decision,decided_by=auth.uid(),decided_at=now(),decision_note=nullif(trim(_note),'') WHERE id=r.id;
 INSERT INTO public.complaint_events(org_id,complaint_id,actor,kind,detail) VALUES(r.org_id,r.complaint_id,auth.uid(),'reopen_request_'||_decision,jsonb_build_object('request_id',r.id,'text','Reopening request '||_decision||coalesce(': '||nullif(trim(_note),''),'')));
 INSERT INTO public.notifications(org_id,user_id,kind,title,complaint_id,actor,dedupe_key) VALUES(r.org_id,r.requested_by,'reopen_'||_decision,'Reopening request '||_decision,r.complaint_id,auth.uid(),'reopen_'||_decision||':'||r.id::text) ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 END $$;
CREATE FUNCTION public.withdraw_reopen_request(_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.reopen_requests; BEGIN
 SELECT * INTO r FROM public.reopen_requests WHERE id=_request;
 IF r.id IS NULL OR r.requested_by IS DISTINCT FROM auth.uid() OR NOT public.is_org_member(r.org_id) THEN RAISE EXCEPTION 'Only the requester can withdraw'; END IF;
 PERFORM 1 FROM public.complaints WHERE id=r.complaint_id AND org_id=r.org_id FOR UPDATE;
 SELECT * INTO r FROM public.reopen_requests WHERE id=_request FOR UPDATE;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
 UPDATE public.reopen_requests SET status='withdrawn' WHERE id=r.id; END $$;
CREATE FUNCTION public.expire_reopen_requests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='reopened' OR NEW.legal_hold OR NEW.privacy_processing OR NEW.anonymised_at IS NOT NULL THEN UPDATE public.reopen_requests SET status='expired' WHERE complaint_id=NEW.id AND org_id=NEW.org_id AND status='pending'; END IF; RETURN NEW; END $$;
CREATE TRIGGER expire_reopen_requests AFTER UPDATE OF status,legal_hold,privacy_processing,anonymised_at ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.expire_reopen_requests();
-- Banner only: exposes pending requests to current case readers without widening agent table SELECT.
CREATE FUNCTION public.case_reopen_requests(_org uuid,_case uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.can_read_mention_case(_org,_case,auth.uid()) THEN RAISE EXCEPTION 'Case access required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('requester_name',coalesce(p.full_name,'Agent'))) FROM public.reopen_requests r LEFT JOIN public.profiles p ON p.id=r.requested_by WHERE r.org_id=_org AND r.complaint_id=_case AND r.status='pending'),'[]'::jsonb); END $$;
REVOKE ALL ON FUNCTION public.request_reopen(uuid,uuid,text,text),public.decide_reopen_request(uuid,text,text,text),public.withdraw_reopen_request(uuid),public.case_reopen_requests(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_reopen(uuid,uuid,text,text),public.decide_reopen_request(uuid,text,text,text),public.withdraw_reopen_request(uuid),public.case_reopen_requests(uuid,uuid) TO authenticated;
ALTER TABLE public.notification_preferences DROP CONSTRAINT notification_preferences_kind_check;
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_kind_check CHECK(kind IN ('mention','assigned','qa_pending','qa_returned','qa_sample','reopened','deadline_at_risk','deadline_overdue','reopen_requested','reopen_approved','reopen_rejected'));
CREATE OR REPLACE FUNCTION public.notification_preferences_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF TG_OP='UPDATE' AND (NEW.user_id,NEW.org_id,NEW.kind) IS DISTINCT FROM (OLD.user_id,OLD.org_id,OLD.kind) THEN RAISE EXCEPTION 'Preference identity cannot change'; END IF; IF NEW.kind IN ('mention','qa_returned','reopen_approved','reopen_rejected') AND NOT NEW.in_app THEN RAISE EXCEPTION 'This notification is always enabled'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.notifications_prepare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ref text; BEGIN
IF NEW.actor IS NULL THEN NEW.actor:=auth.uid(); END IF;
IF NEW.actor=NEW.user_id THEN RETURN NULL; END IF;
IF NOT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=NEW.org_id AND user_id=NEW.user_id AND active) THEN RETURN NULL; END IF;
IF NEW.complaint_id IS NOT NULL AND NOT public.can_read_mention_case(NEW.org_id,NEW.complaint_id,NEW.user_id) THEN RETURN NULL; END IF;
IF NEW.kind NOT IN ('mention','qa_returned','reopen_approved','reopen_rejected') AND EXISTS(SELECT 1 FROM public.notification_preferences WHERE user_id=NEW.user_id AND org_id=NEW.org_id AND kind=NEW.kind AND NOT in_app) THEN RETURN NULL; END IF;
IF NEW.complaint_id IS NOT NULL THEN
 SELECT reference INTO ref FROM public.complaints WHERE id=NEW.complaint_id AND org_id=NEW.org_id;
 NEW.link_path:=coalesce(NEW.link_path,'/app/c/'||NEW.complaint_id::text);
 IF NEW.kind='assigned' AND current_setting('redress.auto_case',true)=NEW.complaint_id::text THEN NEW.title:='Complaint assigned to you automatically: '||ref; END IF;
END IF;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.timeline_group(_kind text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN _kind='note' THEN 'notes' WHEN _kind IN ('letter_sent','letter_drafted') THEN 'letters' WHEN _kind IN ('status','deadline','deadline_recalculated','reopened','reopen_requested','reopen_request_approved','reopen_request_rejected') THEN 'status' WHEN _kind IN ('attachment','attachment_removed') THEN 'attachments' WHEN _kind='qa_returned' THEN 'qa' WHEN _kind IN ('adr_escalated','adr_decision') THEN 'adr' ELSE 'system' END $$;