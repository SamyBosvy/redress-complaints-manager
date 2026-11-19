DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
REVOKE INSERT,DELETE,TRUNCATE ON public.notifications FROM authenticated,anon;
ALTER TABLE public.notifications ADD COLUMN link_path text, ADD COLUMN actor uuid, ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX notifications_recipient_dedupe ON public.notifications(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX notifications_user_created ON public.notifications(user_id,created_at DESC,id DESC);
DROP POLICY "notifications read own" ON public.notifications;
DROP POLICY "notifications update own" ON public.notifications;
CREATE POLICY "notifications read own" ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_org_member(org_id) AND (complaint_id IS NULL OR public.can_read_mention_case(org_id,complaint_id,auth.uid())));
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.is_org_member(org_id) AND (complaint_id IS NULL OR public.can_read_mention_case(org_id,complaint_id,auth.uid()))) WITH CHECK(user_id=auth.uid() AND public.is_org_member(org_id) AND (complaint_id IS NULL OR public.can_read_mention_case(org_id,complaint_id,auth.uid())));
CREATE TABLE public.notification_preferences(user_id uuid NOT NULL,org_id uuid NOT NULL REFERENCES public.organisations(id),kind text NOT NULL CHECK(kind IN ('mention','assigned','qa_pending','qa_returned','qa_sample','reopened','deadline_at_risk','deadline_overdue')),in_app boolean NOT NULL DEFAULT true,PRIMARY KEY(user_id,org_id,kind));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_own ON public.notification_preferences TO authenticated USING(user_id=auth.uid() AND public.is_org_member(org_id)) WITH CHECK(user_id=auth.uid() AND public.is_org_member(org_id));
CREATE FUNCTION public.notification_preferences_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF TG_OP='UPDATE' AND (NEW.user_id,NEW.org_id,NEW.kind) IS DISTINCT FROM (OLD.user_id,OLD.org_id,OLD.kind) THEN RAISE EXCEPTION 'Preference identity cannot change'; END IF; IF NEW.kind IN ('mention','qa_returned') AND NOT NEW.in_app THEN RAISE EXCEPTION 'Mentions and QA returns are always enabled'; END IF; RETURN NEW; END $$;
CREATE TRIGGER notification_preferences_guard BEFORE INSERT OR UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.notification_preferences_guard();
CREATE TRIGGER notification_preferences_audit AFTER INSERT OR UPDATE OR DELETE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE FUNCTION public.notifications_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF current_user IN ('authenticated','anon') THEN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Only trusted functions create or delete notifications'; END IF;
 IF OLD.user_id IS DISTINCT FROM auth.uid() OR (to_jsonb(NEW)-'read_at') IS DISTINCT FROM (to_jsonb(OLD)-'read_at') THEN RAISE EXCEPTION 'Only your notification read status can change'; END IF;
END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER notifications_guard BEFORE INSERT OR UPDATE OR DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notifications_guard();
CREATE FUNCTION public.notifications_prepare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ref text; BEGIN
IF NEW.actor IS NULL THEN NEW.actor:=auth.uid(); END IF;
IF NEW.actor=NEW.user_id THEN RETURN NULL; END IF;
IF NOT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=NEW.org_id AND user_id=NEW.user_id AND active) THEN RETURN NULL; END IF;
IF NEW.complaint_id IS NOT NULL AND NOT public.can_read_mention_case(NEW.org_id,NEW.complaint_id,NEW.user_id) THEN RETURN NULL; END IF;
IF NEW.kind NOT IN ('mention','qa_returned') AND EXISTS(SELECT 1 FROM public.notification_preferences WHERE user_id=NEW.user_id AND org_id=NEW.org_id AND kind=NEW.kind AND NOT in_app) THEN RETURN NULL; END IF;
IF NEW.complaint_id IS NOT NULL THEN
 SELECT reference INTO ref FROM public.complaints WHERE id=NEW.complaint_id AND org_id=NEW.org_id;
 NEW.link_path:=coalesce(NEW.link_path,'/app/c/'||NEW.complaint_id::text);
 IF NEW.kind='assigned' AND current_setting('redress.auto_case',true)=NEW.complaint_id::text THEN NEW.title:='Complaint assigned to you automatically: '||ref; END IF;
END IF;
RETURN NEW; END $$;
CREATE TRIGGER notifications_prepare BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notifications_prepare();
CREATE OR REPLACE FUNCTION public.notify_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NEW.assigned_to IS NOT NULL AND (TG_OP='INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
INSERT INTO public.notifications(org_id,user_id,kind,title,complaint_id,actor) VALUES(NEW.org_id,NEW.assigned_to,'assigned','Complaint assigned to you: '||NEW.reference,NEW.id,auth.uid());
END IF; RETURN NEW; END $$;
CREATE FUNCTION public.notification_mention() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE who text;ref text; BEGIN
SELECT coalesce(nullif(full_name,''),'Firm member') INTO who FROM public.profiles WHERE id=NEW.mentioned_by;
SELECT reference INTO ref FROM public.complaints WHERE id=NEW.complaint_id AND org_id=NEW.org_id;
INSERT INTO public.notifications(org_id,user_id,kind,title,complaint_id,actor,link_path,dedupe_key) VALUES(NEW.org_id,NEW.mentioned_user,'mention',coalesce(who,'Firm member')||' mentioned you on '||ref,NEW.complaint_id,NEW.mentioned_by,'/app/c/'||NEW.complaint_id::text||'?timeline_groups=notes','mention:'||NEW.id::text) ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
RETURN NEW; END $$;
CREATE TRIGGER notification_mention AFTER INSERT ON public.note_mentions FOR EACH ROW EXECUTE FUNCTION public.notification_mention();
CREATE FUNCTION public.notification_reopened() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.complaints; BEGIN
SELECT * INTO c FROM public.complaints WHERE id=NEW.complaint_id AND org_id=NEW.org_id;
IF c.assigned_to IS NOT NULL THEN INSERT INTO public.notifications(org_id,user_id,kind,title,complaint_id,actor,dedupe_key) VALUES(NEW.org_id,c.assigned_to,'reopened','Complaint reopened: '||c.reference,c.id,NEW.reopened_by,'reopened:'||NEW.id::text) ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING; END IF; RETURN NEW; END $$;
CREATE TRIGGER notification_reopened AFTER INSERT ON public.complaint_reopenings FOR EACH ROW EXECUTE FUNCTION public.notification_reopened();
CREATE FUNCTION public.notification_deadline_job(_at timestamptz DEFAULT now()) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c record;d date;k text;recipient uuid;total integer:=0;changed integer; BEGIN
FOR c IN SELECT c.*,o.time_zone FROM public.complaints c JOIN public.organisations o ON o.id=c.org_id WHERE c.status<>'closed' AND c.anonymised_at IS NULL AND NOT c.privacy_processing LOOP
 d:=public.firm_date(c.org_id,_at);
 k:=CASE WHEN c.final_due<d OR (c.ack_due<d AND NOT EXISTS(SELECT 1 FROM public.letters l WHERE l.org_id=c.org_id AND l.complaint_id=c.id AND l.kind='acknowledgement' AND l.sent_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.complaint_events e WHERE e.org_id=c.org_id AND e.complaint_id=c.id AND e.detail->>'after'='acknowledged')) THEN 'deadline_overdue' WHEN c.final_due BETWEEN d AND public.add_business_days(c.org_id,c.country_code,d,3) THEN 'deadline_at_risk' ELSE NULL END;
 IF k IS NULL THEN CONTINUE; END IF;
 FOR recipient IN SELECT m.user_id FROM public.org_members m WHERE m.org_id=c.org_id AND m.active AND ((c.assigned_to IS NOT NULL AND m.user_id=c.assigned_to) OR (c.assigned_to IS NULL AND m.role='complaints_manager')) LOOP
 INSERT INTO public.notifications(org_id,user_id,kind,title,complaint_id,link_path,dedupe_key,created_at) VALUES(c.org_id,recipient,k,CASE WHEN k='deadline_overdue' THEN 'Response deadline overdue: ' ELSE 'Final response due within 3 business days: ' END||c.reference,c.id,'/app/c/'||c.id::text,k||':'||c.id::text||':'||d::text,_at) ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS changed=ROW_COUNT; total:=total+changed;
 END LOOP;
END LOOP; RETURN total; END $$;
REVOKE ALL ON FUNCTION public.notification_deadline_job(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_deadline_job(timestamptz) TO service_role;
CREATE FUNCTION public.notification_retention_job() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN DELETE FROM public.notifications WHERE created_at<now()-interval '90 days'; GET DIAGNOSTICS n=ROW_COUNT;RETURN n; END $$;
REVOKE ALL ON FUNCTION public.notification_retention_job() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_retention_job() TO service_role;