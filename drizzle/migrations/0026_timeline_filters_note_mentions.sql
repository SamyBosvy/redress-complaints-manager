CREATE FUNCTION public.can_read_mention_case(_org uuid,_case uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.org_members m JOIN public.complaints c ON c.org_id=m.org_id WHERE m.org_id=_org AND c.id=_case AND m.user_id=_user AND m.active AND (m.role IN ('org_admin','complaints_manager','qa_reviewer','read_only') OR (m.role='agent' AND c.assigned_to=_user))) $$;
REVOKE ALL ON FUNCTION public.can_read_mention_case(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_mention_case(uuid,uuid,uuid) TO authenticated,service_role;
CREATE TABLE public.note_mentions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,event_id uuid NOT NULL REFERENCES public.complaint_events(id) ON DELETE CASCADE,mentioned_user uuid NOT NULL,mentioned_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,UNIQUE(event_id,mentioned_user));
GRANT SELECT,UPDATE ON public.note_mentions TO authenticated;
GRANT ALL ON public.note_mentions TO service_role;
ALTER TABLE public.note_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mentions_read ON public.note_mentions FOR SELECT TO authenticated USING(mentioned_user=auth.uid() AND public.can_read_mention_case(org_id,complaint_id,auth.uid()));
CREATE POLICY mentions_update ON public.note_mentions FOR UPDATE TO authenticated USING(mentioned_user=auth.uid() AND public.can_read_mention_case(org_id,complaint_id,auth.uid())) WITH CHECK(mentioned_user=auth.uid() AND public.can_read_mention_case(org_id,complaint_id,auth.uid()));
CREATE FUNCTION public.mention_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN IF current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Mentions cannot be deleted'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN IF (to_jsonb(NEW)-'read_at') IS DISTINCT FROM (to_jsonb(OLD)-'read_at') THEN RAISE EXCEPTION 'Only read_at can change'; END IF; NEW.read_at:=now(); END IF; RETURN NEW; END $$;
CREATE TRIGGER mention_guard BEFORE UPDATE OR DELETE ON public.note_mentions FOR EACH ROW EXECUTE FUNCTION public.mention_guard();
CREATE TRIGGER mention_no_truncate BEFORE TRUNCATE ON public.note_mentions FOR EACH STATEMENT EXECUTE FUNCTION public.mention_guard();
CREATE TRIGGER mention_audit AFTER INSERT OR UPDATE OR DELETE ON public.note_mentions FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE INDEX mentions_unread ON public.note_mentions(org_id,mentioned_user,created_at,id) WHERE read_at IS NULL;
CREATE FUNCTION public.add_note_with_mentions(_complaint_id uuid,_text text,_mentions uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.complaints; e uuid; u uuid; BEGIN
 SELECT * INTO c FROM public.complaints WHERE id=_complaint_id FOR UPDATE;
 IF c.id IS NULL OR NOT public.can_read_mention_case(c.org_id,c.id,auth.uid()) OR NOT public.has_org_role(c.org_id,ARRAY['org_admin','complaints_manager','qa_reviewer','agent']::public.app_role[]) THEN RAISE EXCEPTION 'You cannot add notes to this case'; END IF;
 IF c.anonymised_at IS NOT NULL OR c.privacy_processing THEN RAISE EXCEPTION 'This complaint is read-only'; END IF;
 IF length(trim(coalesce(_text,''))) NOT BETWEEN 1 AND 5000 OR cardinality(coalesce(_mentions,'{}'))>50 THEN RAISE EXCEPTION 'Invalid note or too many mentions'; END IF;
 FOR u IN SELECT DISTINCT unnest(coalesce(_mentions,'{}')) LOOP IF u IS NULL OR NOT public.can_read_mention_case(c.org_id,c.id,u) THEN RAISE EXCEPTION 'Mention recipient cannot read this case'; END IF; END LOOP;
 INSERT INTO public.complaint_events(org_id,complaint_id,actor,kind,detail) VALUES(c.org_id,c.id,auth.uid(),'note',jsonb_build_object('text',trim(_text),'mentions',to_jsonb(ARRAY(SELECT DISTINCT unnest(coalesce(_mentions,'{}')))))) RETURNING id INTO e;
 INSERT INTO public.note_mentions(org_id,complaint_id,event_id,mentioned_user,mentioned_by) SELECT c.org_id,c.id,e,u,auth.uid() FROM (SELECT DISTINCT unnest(coalesce(_mentions,'{}')) u) x;
 RETURN e; END $$;
REVOKE ALL ON FUNCTION public.add_note_with_mentions(uuid,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_note_with_mentions(uuid,text,uuid[]) TO authenticated;
CREATE FUNCTION public.case_mention_members(_complaint_id uuid) RETURNS TABLE(user_id uuid,name text,role public.app_role) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.complaints; BEGIN SELECT * INTO c FROM public.complaints WHERE id=_complaint_id; IF c.id IS NULL OR NOT public.can_read_mention_case(c.org_id,c.id,auth.uid()) THEN RAISE EXCEPTION 'Case access denied'; END IF; RETURN QUERY SELECT m.user_id,coalesce(nullif(p.full_name,''),nullif(p.email,''),'Firm member'),m.role FROM public.org_members m LEFT JOIN public.profiles p ON p.id=m.user_id WHERE m.org_id=c.org_id AND public.can_read_mention_case(c.org_id,c.id,m.user_id) ORDER BY p.full_name,m.user_id; END $$;
REVOKE ALL ON FUNCTION public.case_mention_members(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.case_mention_members(uuid) TO authenticated;
CREATE FUNCTION public.timeline_group(_kind text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN _kind='note' THEN 'notes' WHEN _kind IN ('letter_sent','letter_drafted') THEN 'letters' WHEN _kind IN ('status','deadline','deadline_recalculated','reopened') THEN 'status' WHEN _kind IN ('attachment','attachment_removed') THEN 'attachments' WHEN _kind IN ('qa_approved','qa_returned','qa_passed','qa_failed','qa_pending','qa_sample','qa_decided','qa_review') THEN 'qa' WHEN _kind IN ('adr_escalated','adr_decision') THEN 'adr' ELSE 'system' END $$;
CREATE FUNCTION public.case_timeline_page(_case uuid,_groups text[] DEFAULT '{}',_query text DEFAULT '',_mine boolean DEFAULT false,_oldest boolean DEFAULT false,_cursor_time timestamptz DEFAULT NULL,_cursor_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$ DECLARE o uuid; result jsonb; BEGIN
 SELECT org_id INTO o FROM public.complaints WHERE id=_case;
 IF o IS NULL OR NOT public.can_read_mention_case(o,_case,auth.uid()) THEN RAISE EXCEPTION 'Case access denied'; END IF;
 WITH filtered AS (
 SELECT e.* FROM public.complaint_events e LEFT JOIN public.complaint_attachments a ON a.complaint_id=e.complaint_id AND a.org_id=e.org_id AND a.storage_path=e.detail->>'path'
 WHERE e.complaint_id=_case AND e.org_id=o AND (cardinality(_groups)=0 OR public.timeline_group(e.kind)=ANY(_groups)) AND (NOT _mine OR e.detail->'mentions' @> to_jsonb(ARRAY[auth.uid()::text])) AND (coalesce(_query,'')='' OR (e.kind='note' AND strpos(lower(coalesce(e.detail->>'text','')),lower(left(_query,200)))>0) OR (e.kind IN ('attachment','attachment_removed') AND strpos(lower(coalesce(a.file_name,e.detail->>'name','')),lower(left(_query,200)))>0))
 ), page AS (SELECT * FROM filtered WHERE _cursor_time IS NULL OR CASE WHEN _oldest THEN (created_at,id)>(_cursor_time,_cursor_id) ELSE (created_at,id)<(_cursor_time,_cursor_id) END ORDER BY CASE WHEN _oldest THEN created_at END ASC,CASE WHEN _oldest THEN id END ASC,CASE WHEN NOT _oldest THEN created_at END DESC,CASE WHEN NOT _oldest THEN id END DESC LIMIT 50)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM public.complaint_events WHERE org_id=o AND complaint_id=_case),'matching',(SELECT count(*) FROM filtered),'events',coalesce((SELECT jsonb_agg(to_jsonb(page)) FROM page),'[]'::jsonb)) INTO result;
 RETURN result; END $$;
REVOKE ALL ON FUNCTION public.case_timeline_page(uuid,text[],text,boolean,boolean,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.case_timeline_page(uuid,text[],text,boolean,boolean,timestamptz,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';