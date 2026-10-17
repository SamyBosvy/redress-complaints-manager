CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL,
  actor uuid,
  table_name text NOT NULL,
  row_id text,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_time ON public.audit_log(org_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, ARRAY['org_admin','complaints_manager','read_only']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries cannot be changed or deleted';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON public.audit_log FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_immutable();

CREATE OR REPLACE FUNCTION public.audit_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o jsonb; n jsonb; org uuid; rid text;
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND o = n THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'organisations' THEN org := COALESCE(n->>'id', o->>'id')::uuid;
  ELSE org := COALESCE(n->>'org_id', o->>'org_id')::uuid; END IF;
  rid := COALESCE(n->>'id', o->>'id');
  INSERT INTO public.audit_log (org_id, actor, table_name, row_id, action, before, after)
  VALUES (org, auth.uid(), TG_TABLE_NAME, rid, lower(TG_OP), o, n);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.audit_capture() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_organisations AFTER INSERT OR UPDATE OR DELETE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_org_members AFTER INSERT OR UPDATE OR DELETE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_org_countries AFTER INSERT OR UPDATE OR DELETE ON public.org_countries FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_holidays AFTER INSERT OR UPDATE OR DELETE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_rule_sets AFTER INSERT OR UPDATE OR DELETE ON public.rule_sets FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_rule_set_assignments AFTER INSERT OR UPDATE OR DELETE ON public.rule_set_assignments FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_complaints AFTER INSERT OR UPDATE OR DELETE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_complaint_events AFTER INSERT ON public.complaint_events FOR EACH ROW WHEN (NEW.kind IN ('note','attachment')) EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_templates AFTER INSERT OR UPDATE OR DELETE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.audit_capture();
CREATE TRIGGER audit_letters AFTER INSERT ON public.letters FOR EACH ROW EXECUTE FUNCTION public.audit_capture();