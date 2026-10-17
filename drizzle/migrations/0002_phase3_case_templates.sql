CREATE TYPE public.template_kind AS ENUM ('acknowledgement','holding','final_upheld','final_partially_upheld','final_not_upheld','information_request','closure');

CREATE TABLE public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  actor uuid,
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaint_events_c ON public.complaint_events(complaint_id, created_at);
GRANT SELECT, INSERT ON public.complaint_events TO authenticated;
GRANT ALL ON public.complaint_events TO service_role;
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events read" ON public.complaint_events FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "events insert" ON public.complaint_events FOR INSERT TO authenticated WITH CHECK (
  actor = auth.uid() AND kind IN ('note','attachment')
  AND public.has_org_role(org_id, ARRAY['org_admin','complaints_manager','agent','qa_reviewer']::public.app_role[])
  AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.org_id = complaint_events.org_id));

CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  kind public.template_kind NOT NULL,
  language text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, kind, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates read" ON public.templates FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "templates write" ON public.templates FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['org_admin','complaints_manager']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin','complaints_manager']::public.app_role[]));

CREATE TABLE public.letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  kind public.template_kind NOT NULL,
  language text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid NOT NULL DEFAULT auth.uid()
);
GRANT SELECT, INSERT ON public.letters TO authenticated;
GRANT ALL ON public.letters TO service_role;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "letters read" ON public.letters FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "letters insert" ON public.letters FOR INSERT TO authenticated WITH CHECK (
  sent_by = auth.uid()
  AND public.has_org_role(org_id, ARRAY['org_admin','complaints_manager','agent','qa_reviewer']::public.app_role[])
  AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.org_id = letters.org_id));

CREATE OR REPLACE FUNCTION public.letters_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
  VALUES (NEW.org_id, NEW.complaint_id, NEW.sent_by, 'letter_sent', jsonb_build_object('letter_id', NEW.id, 'template', NEW.kind, 'language', NEW.language));
  RETURN NEW;
END $$;
CREATE TRIGGER letters_ai AFTER INSERT ON public.letters FOR EACH ROW EXECUTE FUNCTION public.letters_after_insert();

CREATE OR REPLACE FUNCTION public.complaints_log_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'created', jsonb_build_object('reference', NEW.reference, 'channel', NEW.channel, 'final_due', NEW.final_due));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'status', jsonb_build_object('before', OLD.status, 'after', NEW.status));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'reassigned', jsonb_build_object('before', OLD.assigned_to, 'after', NEW.assigned_to));
  END IF;
  IF NEW.holding_sent_at IS DISTINCT FROM OLD.holding_sent_at OR NEW.final_due IS DISTINCT FROM OLD.final_due OR NEW.extended_due IS DISTINCT FROM OLD.extended_due THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'deadline', jsonb_build_object(
      'before', CASE WHEN OLD.holding_sent_at IS NOT NULL THEN OLD.extended_due ELSE OLD.final_due END,
      'after', CASE WHEN NEW.holding_sent_at IS NOT NULL THEN NEW.extended_due ELSE NEW.final_due END,
      'reason', NEW.holding_reason));
  END IF;
  IF NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.redress_amount IS DISTINCT FROM OLD.redress_amount
     OR NEW.goodwill_amount IS DISTINCT FROM OLD.goodwill_amount OR NEW.root_cause_category IS DISTINCT FROM OLD.root_cause_category THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'outcome', jsonb_build_object(
      'before', jsonb_build_object('outcome', OLD.outcome, 'redress', OLD.redress_amount, 'goodwill', OLD.goodwill_amount, 'root_cause', OLD.root_cause_category),
      'after', jsonb_build_object('outcome', NEW.outcome, 'redress', NEW.redress_amount, 'goodwill', NEW.goodwill_amount, 'root_cause', NEW.root_cause_category)));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.complaint_events (org_id, complaint_id, actor, kind, detail)
    VALUES (NEW.org_id, NEW.id, a, 'priority', jsonb_build_object('before', OLD.priority, 'after', NEW.priority));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_log AFTER INSERT OR UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.complaints_log_changes();

-- set closed_at automatically
CREATE OR REPLACE FUNCTION public.complaints_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.org_id := OLD.org_id; NEW.reference := OLD.reference; NEW.seq := OLD.seq; NEW.created_by := OLD.created_by;
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN NEW.closed_at := now(); END IF;
  IF NEW.status = 'reopened' THEN NEW.closed_at := NULL; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.seed_templates(_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE adr text := E'\n\nIf you are not satisfied with our response, you may refer your complaint to {adr_body_name} free of charge. Contact: {adr_body_contact}.';
BEGIN
  INSERT INTO public.templates (org_id, kind, language, subject, body) VALUES
  (_org,'acknowledgement','en','Your complaint {reference}', E'Dear {customer_name},\n\nThank you for contacting us. We received your complaint on {date_received} and our reference is {reference}.\n\nWe will send you our final response by {final_deadline}.\n\nYours sincerely,\n{agent_name}\n{firm_name}'),
  (_org,'holding','en','Update on your complaint {reference}', E'Dear {customer_name},\n\nWe are still investigating your complaint {reference}. We have not been able to complete our investigation because [reason for the delay].\n\nWe will send you our final response by {final_deadline}.\n\nYours sincerely,\n{agent_name}\n{firm_name}'),
  (_org,'final_upheld','en','Final response to your complaint {reference}', E'Dear {customer_name},\n\nWe have completed our investigation of your complaint received on {date_received}. We uphold your complaint.\n\n[Findings and remedy]' || adr || E'\n\nYours sincerely,\n{agent_name}\n{firm_name}'),
  (_org,'final_partially_upheld','en','Final response to your complaint {reference}', E'Dear {customer_name},\n\nWe have completed our investigation of your complaint received on {date_received}. We partially uphold your complaint.\n\n[Findings and remedy]' || adr || E'\n\nYours sincerely,\n{agent_name}\n{firm_name}'),
  (_org,'final_not_upheld','en','Final response to your complaint {reference}', E'Dear {customer_name},\n\nWe have completed our investigation of your complaint received on {date_received}. We do not uphold your complaint.\n\n[Findings and reasons]' || adr || E'\n\nYours sincerely,\n{agent_name}\n{firm_name}'),
  (_org,'information_request','en','Information needed for your complaint {reference}', E'Dear {customer_name},\n\nTo investigate your complaint {reference}, we need the following information:\n\n[Information needed]\n\nYours sincerely,\n{agent_name}\n{firm_name}'),
  (_org,'closure','en','Your complaint {reference} is closed', E'Dear {customer_name},\n\nWe have now closed your complaint {reference}.\n\nYours sincerely,\n{agent_name}\n{firm_name}')
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.create_organisation(_legal_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You already belong to an organisation';
  END IF;
  IF length(trim(_legal_name)) = 0 OR length(_legal_name) > 200 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  INSERT INTO public.organisations (legal_name, created_by) VALUES (trim(_legal_name), auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (_id, auth.uid(), 'org_admin');
  INSERT INTO public.rule_sets (org_id, name, ack_days, final_days, extended_days, is_default)
    VALUES (_id, 'PSD2 payment services', 1, 15, 35, true);
  PERFORM public.seed_templates(_id);
  RETURN _id;
END $$;

SELECT public.seed_templates(id) FROM public.organisations;
REVOKE EXECUTE ON FUNCTION public.seed_templates(uuid) FROM PUBLIC, anon, authenticated;

-- attachments storage: path = <org_id>/<complaint_id>/<file>
CREATE POLICY "attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND public.is_org_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "attachments upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND public.has_org_role(((storage.foldername(name))[1])::uuid, ARRAY['org_admin','complaints_manager','agent','qa_reviewer']::public.app_role[]));