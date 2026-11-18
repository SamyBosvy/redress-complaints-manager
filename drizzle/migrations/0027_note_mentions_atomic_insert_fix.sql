CREATE OR REPLACE FUNCTION public.add_note_with_mentions(_complaint_id uuid,_text text,_mentions uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.complaints; e uuid; recipient uuid; BEGIN
 SELECT * INTO c FROM public.complaints WHERE id=_complaint_id FOR UPDATE;
 IF c.id IS NULL OR NOT public.can_read_mention_case(c.org_id,c.id,auth.uid()) OR NOT public.has_org_role(c.org_id,ARRAY['org_admin','complaints_manager','qa_reviewer','agent']::public.app_role[]) THEN RAISE EXCEPTION 'You cannot add notes to this case'; END IF;
 IF c.anonymised_at IS NOT NULL OR c.privacy_processing THEN RAISE EXCEPTION 'This complaint is read-only'; END IF;
 IF length(trim(coalesce(_text,''))) NOT BETWEEN 1 AND 5000 OR cardinality(coalesce(_mentions,'{}'))>50 THEN RAISE EXCEPTION 'Invalid note or too many mentions'; END IF;
 FOR recipient IN SELECT DISTINCT unnest(coalesce(_mentions,'{}')) LOOP IF recipient IS NULL OR NOT public.can_read_mention_case(c.org_id,c.id,recipient) THEN RAISE EXCEPTION 'Mention recipient cannot read this case'; END IF; END LOOP;
 INSERT INTO public.complaint_events(org_id,complaint_id,actor,kind,detail) VALUES(c.org_id,c.id,auth.uid(),'note',jsonb_build_object('text',trim(_text),'mentions',to_jsonb(ARRAY(SELECT DISTINCT unnest(coalesce(_mentions,'{}')))))) RETURNING id INTO e;
 INSERT INTO public.note_mentions(org_id,complaint_id,event_id,mentioned_user,mentioned_by) SELECT c.org_id,c.id,e,x.recipient_id,auth.uid() FROM (SELECT DISTINCT unnest(coalesce(_mentions,'{}')) recipient_id) x;
 RETURN e; END $$;
REVOKE ALL ON FUNCTION public.add_note_with_mentions(uuid,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_note_with_mentions(uuid,text,uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';