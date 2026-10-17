CREATE TYPE public.complaint_channel AS ENUM ('email','phone','chat','letter','web_form','social_media','in_person');
CREATE TYPE public.complaint_product AS ENUM ('payment_account','card','credit_transfer','direct_debit','e_money_wallet','merchant_acquiring','other');
CREATE TYPE public.complaint_category AS ENUM ('unauthorised_transaction','fraud_or_scam','fees_and_charges','account_blocked_or_closed','payment_delay_or_failure','refund_or_chargeback','customer_service','data_protection','other');
CREATE TYPE public.complaint_status AS ENUM ('received','acknowledged','under_investigation','holding_response_sent','final_response_sent','closed','escalated_to_adr','reopened');
CREATE TYPE public.complaint_priority AS ENUM ('standard','high');
CREATE TYPE public.complaint_outcome AS ENUM ('upheld','partially_upheld','not_upheld','withdrawn');

CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  reference text NOT NULL DEFAULT '',
  seq int NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  channel public.complaint_channel NOT NULL,
  country_code text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  complainant_name text NOT NULL,
  complainant_email text,
  complainant_phone text,
  customer_ref text,
  vulnerable boolean NOT NULL DEFAULT false,
  vulnerable_note text,
  product public.complaint_product NOT NULL,
  category public.complaint_category NOT NULL,
  summary text NOT NULL,
  desired_outcome text,
  assigned_to uuid,
  priority public.complaint_priority NOT NULL DEFAULT 'standard',
  status public.complaint_status NOT NULL DEFAULT 'received',
  outcome public.complaint_outcome,
  redress_amount numeric(12,2),
  redress_currency text,
  goodwill_amount numeric(12,2),
  goodwill_currency text,
  root_cause_category text,
  root_cause_note text,
  rule_set_id uuid REFERENCES public.rule_sets(id) ON DELETE SET NULL,
  ack_due date,
  final_due date,
  extended_due date,
  holding_sent_at timestamptz,
  holding_reason text,
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, reference)
);
CREATE INDEX complaints_org_status ON public.complaints(org_id, status);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_business_day(_org uuid, _country text, _d date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(isodow FROM _d) < 6
     AND NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.org_id = _org AND h.country_code = _country AND h.holiday_date = _d)
$$;

CREATE OR REPLACE FUNCTION public.add_business_days(_org uuid, _country text, _start date, _n int)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := _start; c int := 0;
BEGIN
  IF _n <= 0 THEN RETURN _start; END IF;
  WHILE c < _n LOOP
    d := d + 1;
    IF public.is_business_day(_org, _country, d) THEN c := c + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

-- signed count of business days from _from (exclusive) to _to (inclusive); negative if _to before _from
CREATE OR REPLACE FUNCTION public.business_days_between(_org uuid, _country text, _from date, _to date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _to >= _from THEN
    (SELECT count(*)::int FROM generate_series(_from + 1, _to, interval '1 day') g WHERE public.is_business_day(_org, _country, g::date))
  ELSE
    -(SELECT count(*)::int FROM generate_series(_to + 1, _from, interval '1 day') g WHERE public.is_business_day(_org, _country, g::date))
  END
$$;

CREATE OR REPLACE FUNCTION public.resolve_rule_set(_org uuid, _country text, _product text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT rule_set_id FROM public.rule_set_assignments WHERE org_id=_org AND country_code=_country AND product=_product LIMIT 1),
    (SELECT rule_set_id FROM public.rule_set_assignments WHERE org_id=_org AND country_code=_country AND product IS NULL LIMIT 1),
    (SELECT rule_set_id FROM public.rule_set_assignments WHERE org_id=_org AND country_code IS NULL AND product=_product LIMIT 1),
    (SELECT id FROM public.rule_sets WHERE org_id=_org AND is_default ORDER BY created_at LIMIT 1),
    (SELECT id FROM public.rule_sets WHERE org_id=_org ORDER BY created_at LIMIT 1))
$$;

CREATE OR REPLACE FUNCTION public.complaints_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rule_sets; yr int; d date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.org_id::text));
  yr := extract(year FROM NEW.received_at)::int;
  SELECT COALESCE(max(seq),0)+1 INTO NEW.seq FROM public.complaints
    WHERE org_id = NEW.org_id AND extract(year FROM received_at) = yr;
  NEW.reference := 'RDR-' || yr || '-' || lpad(NEW.seq::text, 6, '0');
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  NEW.rule_set_id := COALESCE(NEW.rule_set_id, public.resolve_rule_set(NEW.org_id, NEW.country_code, NEW.product::text));
  SELECT * INTO r FROM public.rule_sets WHERE id = NEW.rule_set_id;
  d := (NEW.received_at AT TIME ZONE 'UTC')::date;
  IF r.id IS NOT NULL THEN
    NEW.ack_due := public.add_business_days(NEW.org_id, NEW.country_code, d, r.ack_days);
    NEW.final_due := public.add_business_days(NEW.org_id, NEW.country_code, d, r.final_days);
    NEW.extended_due := public.add_business_days(NEW.org_id, NEW.country_code, d, r.extended_days);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_bi BEFORE INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.complaints_before_insert();

CREATE OR REPLACE FUNCTION public.complaints_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.org_id := OLD.org_id; NEW.reference := OLD.reference; NEW.seq := OLD.seq; NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER complaints_bu BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.complaints_before_update();

CREATE POLICY "complaints read" ON public.complaints FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "complaints insert" ON public.complaints FOR INSERT TO authenticated WITH CHECK (
  public.has_org_role(org_id, ARRAY['org_admin','complaints_manager','agent','qa_reviewer']::public.app_role[]));
CREATE POLICY "complaints update" ON public.complaints FOR UPDATE TO authenticated USING (
  public.has_org_role(org_id, ARRAY['org_admin','complaints_manager','qa_reviewer']::public.app_role[])
  OR (public.has_org_role(org_id, ARRAY['agent']::public.app_role[]) AND (assigned_to = auth.uid() OR assigned_to IS NULL)));

CREATE VIEW public.complaint_queue WITH (security_invoker = true) AS
SELECT c.*,
  CASE WHEN c.holding_sent_at IS NOT NULL THEN c.extended_due ELSE c.final_due END AS current_due,
  public.business_days_between(c.org_id, c.country_code, current_date,
    CASE WHEN c.holding_sent_at IS NOT NULL THEN c.extended_due ELSE c.final_due END) AS days_left
FROM public.complaints c;
GRANT SELECT ON public.complaint_queue TO authenticated;