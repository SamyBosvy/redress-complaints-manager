DO $$ DECLARE def text; BEGIN
SELECT rtrim(pg_get_viewdef('public.complaint_queue'::regclass,true),E';\n ') INTO def;
EXECUTE 'CREATE OR REPLACE VIEW public.complaint_queue WITH (security_invoker=true) AS SELECT q.*, COALESCE((SELECT min(l.sent_at) FROM public.letters l WHERE l.org_id=q.org_id AND l.complaint_id=q.id AND l.kind=''acknowledgement'' AND l.sent_at IS NOT NULL),(SELECT min(e.created_at) FROM public.complaint_events e WHERE e.org_id=q.org_id AND e.complaint_id=q.id AND e.detail->>''after''=''acknowledged'')) AS acknowledged_at FROM ('||def||') q';
END $$;
CREATE OR REPLACE FUNCTION public.acknowledgement_on_time(public.complaint_queue) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT (($1.acknowledged_at AT TIME ZONE o.time_zone)::date <= $1.ack_due) FROM public.organisations o WHERE o.id=$1.org_id $$;
GRANT EXECUTE ON FUNCTION public.acknowledgement_on_time(public.complaint_queue) TO authenticated;
REVOKE ALL ON public.template_versions FROM anon;