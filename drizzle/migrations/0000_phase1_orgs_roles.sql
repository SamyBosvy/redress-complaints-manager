CREATE TYPE public.app_role AS ENUM ('org_admin','complaints_manager','agent','qa_reviewer','read_only');
CREATE TYPE public.licence_type AS ENUM ('payment_institution','e_money_institution','credit_institution','other');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  licence_type public.licence_type NOT NULL DEFAULT 'payment_institution',
  home_country text,
  regulator text,
  setup_complete boolean NOT NULL DEFAULT false,
  qa_required boolean NOT NULL DEFAULT true,
  qa_sample_pct int NOT NULL DEFAULT 10,
  retention_years int NOT NULL DEFAULT 6,
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  adr_name text,
  adr_website text,
  adr_contact text,
  UNIQUE (org_id, country_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_countries TO authenticated;
GRANT ALL ON public.org_countries TO service_role;
ALTER TABLE public.org_countries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  holiday_date date NOT NULL,
  name text NOT NULL,
  UNIQUE (org_id, country_code, holiday_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  ack_days int NOT NULL DEFAULT 1,
  final_days int NOT NULL DEFAULT 15,
  extended_days int NOT NULL DEFAULT 35,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_sets TO authenticated;
GRANT ALL ON public.rule_sets TO service_role;
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rule_set_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  rule_set_id uuid NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  country_code text,
  product text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_set_assignments TO authenticated;
GRANT ALL ON public.rule_set_assignments TO service_role;
ALTER TABLE public.rule_set_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org AND user_id = auth.uid() AND role = ANY(_roles))
$$;

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
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_organisation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profiles: self + same-org colleagues
CREATE POLICY "profiles self" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = profiles.id AND public.is_org_member(m.org_id)));
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "org read" ON public.organisations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "org admin update" ON public.organisations FOR UPDATE TO authenticated USING (public.has_org_role(id, ARRAY['org_admin']::public.app_role[]));

CREATE POLICY "members read" ON public.org_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "members admin insert" ON public.org_members FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE POLICY "members admin update" ON public.org_members FOR UPDATE TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE POLICY "members admin delete" ON public.org_members FOR DELETE TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]) AND user_id <> auth.uid());

CREATE POLICY "countries read" ON public.org_countries FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "countries admin" ON public.org_countries FOR ALL TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[])) WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE POLICY "holidays read" ON public.holidays FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "holidays admin" ON public.holidays FOR ALL TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[])) WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE POLICY "rules read" ON public.rule_sets FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "rules admin" ON public.rule_sets FOR ALL TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[])) WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));
CREATE POLICY "rsa read" ON public.rule_set_assignments FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "rsa admin" ON public.rule_set_assignments FOR ALL TO authenticated USING (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[])) WITH CHECK (public.has_org_role(org_id, ARRAY['org_admin']::public.app_role[]));