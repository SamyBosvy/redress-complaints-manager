CREATE TYPE public.auto_assign_mode AS ENUM ('off','least_loaded','round_robin');
ALTER TABLE public.organisations ADD COLUMN auto_assign_mode public.auto_assign_mode NOT NULL DEFAULT 'off', ADD COLUMN auto_assign_match_language boolean NOT NULL DEFAULT true, ADD COLUMN auto_assign_sources text[] NOT NULL DEFAULT ARRAY['manual','public_form','import'];
ALTER TABLE public.organisations ADD CONSTRAINT auto_assign_sources_valid CHECK(auto_assign_sources <@ ARRAY['manual','public_form','import']::text[] AND array_position(auto_assign_sources,NULL) IS NULL);
ALTER TABLE public.complaints ADD COLUMN assignment_source text NOT NULL DEFAULT 'manual' CHECK(assignment_source IN ('manual','public_form','import'));
CREATE TABLE public.agent_capacity(org_id uuid NOT NULL REFERENCES public.organisations(id),user_id uuid NOT NULL,max_open_cases integer CHECK(max_open_cases BETWEEN 1 AND 500),accepting_new boolean NOT NULL DEFAULT true,away_from date,away_until date,languages text[] NOT NULL DEFAULT '{}',last_auto_assigned_at timestamptz,last_assigned_at timestamptz,updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(org_id,user_id),CHECK(away_until IS NULL OR (away_from IS NOT NULL AND away_until>=away_from)),CHECK(languages <@ ARRAY['en','fr','es','pt','pl','nl','de','it','lt','sv','da','cs','ro','ga']::text[] AND array_position(languages,NULL) IS NULL));
GRANT SELECT,INSERT,UPDATE ON public.agent_capacity TO authenticated;
GRANT ALL ON public.agent_capacity TO service_role;
ALTER TABLE public.agent_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY capacity_read ON public.agent_capacity FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE POLICY capacity_insert ON public.agent_capacity FOR INSERT TO authenticated WITH CHECK(public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]));
CREATE POLICY capacity_update ON public.agent_capacity FOR UPDATE TO authenticated USING(public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) OR (public.is_org_member(org_id) AND user_id=auth.uid())) WITH CHECK(public.has_org_role(org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) OR (public.is_org_member(org_id) AND user_id=auth.uid()));
CREATE FUNCTION public.capacity_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Capacity records cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (NEW.org_id,NEW.user_id) IS DISTINCT FROM (OLD.org_id,OLD.user_id) THEN RAISE EXCEPTION 'Capacity identity cannot change'; END IF;
 IF current_user IN ('authenticated','anon') THEN
 IF NOT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=NEW.org_id AND user_id=NEW.user_id AND active AND role='agent') THEN RAISE EXCEPTION 'Choose an active agent'; END IF;
 IF TG_OP='UPDATE' AND (NEW.last_auto_assigned_at,NEW.last_assigned_at) IS DISTINCT FROM (OLD.last_auto_assigned_at,OLD.last_assigned_at) THEN RAISE EXCEPTION 'Assignment timestamps are system-managed'; END IF;
 IF TG_OP='INSERT' AND (NEW.last_auto_assigned_at IS NOT NULL OR NEW.last_assigned_at IS NOT NULL) THEN RAISE EXCEPTION 'Assignment timestamps are system-managed'; END IF;
 IF NOT public.has_org_role(NEW.org_id,ARRAY['org_admin','complaints_manager']::public.app_role[]) THEN
 IF TG_OP<>'UPDATE' OR NEW.user_id IS DISTINCT FROM auth.uid() OR NOT public.is_org_member(NEW.org_id) OR (to_jsonb(NEW)-ARRAY['accepting_new','away_from','away_until','updated_by','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['accepting_new','away_from','away_until','updated_by','updated_at']) THEN RAISE EXCEPTION 'Only your availability can change'; END IF;
 END IF;
 NEW.updated_by:=auth.uid(); END IF; NEW.updated_at:=now(); RETURN NEW; END $$;
CREATE TRIGGER capacity_guard BEFORE INSERT OR UPDATE OR DELETE ON public.agent_capacity FOR EACH ROW EXECUTE FUNCTION public.capacity_guard();
CREATE TRIGGER capacity_no_truncate BEFORE TRUNCATE ON public.agent_capacity FOR EACH STATEMENT EXECUTE FUNCTION public.capacity_guard();
CREATE TRIGGER capacity_audit AFTER INSERT OR UPDATE OR DELETE ON public.agent_capacity FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
INSERT INTO public.agent_capacity(org_id,user_id,last_assigned_at) SELECT m.org_id,m.user_id,(SELECT max(e.created_at) FROM public.complaint_events e WHERE e.org_id=m.org_id AND e.kind='reassigned' AND coalesce(e.detail->>'after',e.detail->>'to')=m.user_id::text) FROM public.org_members m WHERE m.role='agent' ON CONFLICT DO NOTHING;
CREATE FUNCTION public.ensure_agent_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.role='agent' THEN INSERT INTO public.agent_capacity(org_id,user_id) VALUES(NEW.org_id,NEW.user_id) ON CONFLICT DO NOTHING; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.ensure_agent_capacity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ensure_agent_capacity AFTER INSERT OR UPDATE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.ensure_agent_capacity();
CREATE FUNCTION public.auto_assignment_settings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF (NEW.auto_assign_mode,NEW.auto_assign_match_language,NEW.auto_assign_sources) IS DISTINCT FROM (OLD.auto_assign_mode,OLD.auto_assign_match_language,OLD.auto_assign_sources) AND auth.uid() IS NOT NULL AND NOT public.has_org_role(OLD.id,ARRAY['org_admin']::public.app_role[]) THEN RAISE EXCEPTION 'Only Org Admins can change auto-assignment'; END IF; RETURN NEW; END $$;
CREATE TRIGGER auto_assignment_settings_guard BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.auto_assignment_settings_guard();
CREATE FUNCTION public.pick_assignee(_org uuid,_complaint uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.complaints; o public.organisations; chosen uuid; BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.has_org_role(_org,ARRAY['org_admin','complaints_manager']::public.app_role[]) AND current_setting('redress.auto_case',true) IS DISTINCT FROM _complaint::text THEN RAISE EXCEPTION 'Only assignment managers can pick an agent'; END IF;
 SELECT * INTO o FROM public.organisations WHERE id=_org FOR UPDATE;
 SELECT * INTO c FROM public.complaints WHERE id=_complaint AND org_id=_org;
 IF o.id IS NULL OR o.auto_assign_mode='off' OR c.id IS NULL OR c.assigned_to IS NOT NULL OR c.status='closed' OR c.anonymised_at IS NOT NULL OR c.privacy_processing THEN RETURN NULL; END IF;
 PERFORM 1 FROM public.agent_capacity WHERE org_id=_org ORDER BY user_id FOR UPDATE;
 WITH eligible AS (SELECT a.*, (SELECT count(*) FROM public.complaints x WHERE x.org_id=_org AND x.assigned_to=a.user_id AND x.status<>'closed') AS open_count FROM public.agent_capacity a JOIN public.org_members m ON m.org_id=a.org_id AND m.user_id=a.user_id WHERE a.org_id=_org AND m.active AND m.role='agent' AND a.accepting_new AND NOT(a.away_from IS NOT NULL AND public.firm_date(_org,now())>=a.away_from AND (a.away_until IS NULL OR public.firm_date(_org,now())<=a.away_until))), available AS (SELECT * FROM eligible WHERE max_open_cases IS NULL OR open_count<max_open_cases)
 SELECT user_id INTO chosen FROM available ORDER BY CASE WHEN o.auto_assign_match_language AND nullif(c.language,'') IS NOT NULL AND c.language=ANY(languages) THEN 0 ELSE 1 END, CASE WHEN o.auto_assign_mode='least_loaded' THEN open_count END, CASE WHEN o.auto_assign_mode='least_loaded' THEN last_assigned_at ELSE last_auto_assigned_at END ASC NULLS FIRST,user_id LIMIT 1;
 RETURN chosen; END $$;
REVOKE ALL ON FUNCTION public.pick_assignee(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pick_assignee(uuid,uuid) TO authenticated,service_role;
CREATE FUNCTION public.assignment_capacity_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.assigned_to IS NOT NULL AND (TG_OP='INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN UPDATE public.agent_capacity SET last_assigned_at=clock_timestamp(),last_auto_assigned_at=CASE WHEN current_setting('redress.auto_case',true)=NEW.id::text THEN clock_timestamp() ELSE last_auto_assigned_at END WHERE org_id=NEW.org_id AND user_id=NEW.assigned_to; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.assignment_capacity_stamp() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assignment_capacity_stamp AFTER INSERT OR UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.assignment_capacity_stamp();
CREATE FUNCTION public.auto_assignment_event() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.kind='reassigned' AND current_setting('redress.auto_case',true)=NEW.complaint_id::text THEN NEW.detail:=NEW.detail||jsonb_build_object('auto',true,'rule',current_setting('redress.auto_rule',true),'to',NEW.detail->'after'); END IF; RETURN NEW; END $$;
CREATE TRIGGER auto_assignment_event BEFORE INSERT ON public.complaint_events FOR EACH ROW EXECUTE FUNCTION public.auto_assignment_event();
CREATE FUNCTION public.auto_assign_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.organisations; u uuid; source text; previous_case text:=current_setting('redress.auto_case',true); previous_rule text:=current_setting('redress.auto_rule',true); BEGIN
 source:=CASE WHEN NEW.channel='web_form' AND NEW.created_by IS NULL THEN 'public_form' ELSE NEW.assignment_source END;
 SELECT * INTO o FROM public.organisations WHERE id=NEW.org_id;
 IF o.auto_assign_mode='off' OR NEW.assigned_to IS NOT NULL OR NOT(source=ANY(o.auto_assign_sources)) OR NEW.status='closed' OR NEW.anonymised_at IS NOT NULL OR NEW.privacy_processing THEN RETURN NEW; END IF;
 PERFORM set_config('redress.auto_case',NEW.id::text,true); PERFORM set_config('redress.auto_rule',o.auto_assign_mode::text,true);
 u:=public.pick_assignee(NEW.org_id,NEW.id);
 IF u IS NOT NULL THEN UPDATE public.complaints SET assigned_to=u WHERE org_id=NEW.org_id AND id=NEW.id AND assigned_to IS NULL; END IF;
 PERFORM set_config('redress.auto_case',coalesce(previous_case,''),true); PERFORM set_config('redress.auto_rule',coalesce(previous_rule,''),true); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.auto_assign_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_auto_assign_insert AFTER INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.auto_assign_insert();
CREATE FUNCTION public.rebalance_complaint(_org uuid,_complaint uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE u uuid; previous_case text:=current_setting('redress.auto_case',true); BEGIN
 IF NOT public.has_org_role(_org,ARRAY['org_admin','complaints_manager']::public.app_role[]) THEN RAISE EXCEPTION 'Only assignment managers can rebalance'; END IF;
 u:=public.pick_assignee(_org,_complaint); IF u IS NULL THEN RETURN NULL; END IF;
 PERFORM set_config('redress.auto_case',_complaint::text,true); PERFORM set_config('redress.auto_rule',(SELECT auto_assign_mode::text FROM public.organisations WHERE id=_org),true);
 UPDATE public.complaints SET assigned_to=u WHERE org_id=_org AND id=_complaint AND assigned_to IS NULL AND status<>'closed' AND anonymised_at IS NULL AND NOT privacy_processing;
 IF NOT FOUND THEN u:=NULL; END IF; PERFORM set_config('redress.auto_case',coalesce(previous_case,''),true); PERFORM set_config('redress.auto_rule','',true); RETURN u; END $$;
REVOKE ALL ON FUNCTION public.rebalance_complaint(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rebalance_complaint(uuid,uuid) TO authenticated;
CREATE FUNCTION public.workload_summary(_org uuid) RETURNS TABLE(user_id uuid,agent_name text,open_cases bigint,overdue bigint,due_soon bigint,ack_overdue bigint,vulnerable_open bigint,high_priority_open bigint,received_30 bigint,max_open_cases integer,accepting_new boolean,away_from date,away_until date,languages text[]) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.has_org_role(_org,ARRAY['org_admin','complaints_manager','qa_reviewer','read_only']::public.app_role[]) THEN RAISE EXCEPTION 'Workload access denied'; END IF;
 RETURN QUERY WITH agents AS(SELECT m.user_id,coalesce(nullif(p.full_name,''),p.email,'Former user') name FROM public.org_members m LEFT JOIN public.profiles p ON p.id=m.user_id WHERE m.org_id=_org AND m.active AND m.role='agent' UNION ALL SELECT NULL::uuid,'Unassigned'::text), counts AS(SELECT c.assigned_to,count(*) FILTER(WHERE c.status<>'closed') op,count(*) FILTER(WHERE c.status<>'closed' AND c.final_due<public.firm_date(_org,now())) od,count(*) FILTER(WHERE c.status<>'closed' AND c.final_due>=public.firm_date(_org,now()) AND c.final_due<=public.add_business_days(_org,c.country_code,public.firm_date(_org,now()),3)) ds,count(*) FILTER(WHERE c.status='received' AND c.ack_due<public.firm_date(_org,now())) ack,count(*) FILTER(WHERE c.status<>'closed' AND c.vulnerable) vuln,count(*) FILTER(WHERE c.status<>'closed' AND c.priority='high') hi,count(*) FILTER(WHERE public.firm_date(_org,c.received_at)>=public.firm_date(_org,now())-29 AND public.firm_date(_org,c.received_at)<=public.firm_date(_org,now())) recent FROM public.complaints c WHERE c.org_id=_org GROUP BY c.assigned_to)
 SELECT a.user_id,a.name,coalesce(c.op,0),coalesce(c.od,0),coalesce(c.ds,0),coalesce(c.ack,0),coalesce(c.vuln,0),coalesce(c.hi,0),coalesce(c.recent,0),cap.max_open_cases,coalesce(cap.accepting_new,true),cap.away_from,cap.away_until,coalesce(cap.languages,'{}'::text[]) FROM agents a LEFT JOIN counts c ON c.assigned_to IS NOT DISTINCT FROM a.user_id LEFT JOIN public.agent_capacity cap ON cap.org_id=_org AND cap.user_id=a.user_id ORDER BY a.user_id NULLS LAST;
 END $$;
REVOKE ALL ON FUNCTION public.workload_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workload_summary(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';