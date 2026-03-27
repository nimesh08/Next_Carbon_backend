-- ============================================================
-- Next Carbon -- Full Supabase Schema
-- Run this in the Supabase SQL Editor on a FRESH project.
-- ============================================================

-- --------------------------------------------------------
-- 1. Custom ENUM types
-- --------------------------------------------------------
CREATE TYPE "Payment Status" AS ENUM ('created', 'success', 'failed');
CREATE TYPE token_type       AS ENUM ('PT', 'CIT', 'VCC');

-- --------------------------------------------------------
-- 2. Core tables
-- --------------------------------------------------------

CREATE TABLE public.users (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  username   text,
  email      text,
  phone      text,
  first_name text,
  last_name  text,
  "Is_Admin" boolean     NOT NULL DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.property_data (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  name                text,
  status              text,
  price               double precision,
  available_shares    integer,
  location            text,
  type                text,
  image               text,
  attributes          jsonb,
  value_parameters    jsonb[],
  updates             jsonb[],
  growth              text        NOT NULL DEFAULT '',
  description         text,
  progress            jsonb,
  "Highlights"        jsonb,
  "totalShares"       integer,
  "Documents"         text[],
  token_address       text,
  weight              numeric     NOT NULL DEFAULT 1,
  is_mature           boolean     NOT NULL DEFAULT false,
  maturity_percentage numeric     NOT NULL DEFAULT 0,
  CONSTRAINT property_data_pkey PRIMARY KEY (id)
);

CREATE TABLE public.owners (
  created_at  timestamptz      NOT NULL DEFAULT now(),
  user_id     uuid             NOT NULL,
  property_id uuid             NOT NULL,
  credits     double precision,
  CONSTRAINT owners_pkey            PRIMARY KEY (user_id, property_id),
  CONSTRAINT owner_user_id_fkey     FOREIGN KEY (user_id)     REFERENCES public.users(id),
  CONSTRAINT owner_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property_data(id)
);

CREATE TABLE public.payments (
  id            uuid              NOT NULL DEFAULT gen_random_uuid(),
  amount        double precision  NOT NULL,
  currency      text,
  order_id      text              UNIQUE,
  receipt_id    text              NOT NULL,
  offer_id      text,
  created_at    timestamptz       NOT NULL DEFAULT now(),
  status        "Payment Status"  DEFAULT 'created'::"Payment Status",
  user_id       uuid              NOT NULL,
  property_id   uuid              NOT NULL,
  credits       bigint,
  shares        bigint            NOT NULL,
  token_tx_hash text,
  CONSTRAINT payments_pkey            PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey    FOREIGN KEY (user_id)     REFERENCES public.users(id),
  CONSTRAINT payments_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property_data(id)
);

CREATE TABLE public."offset" (
  id                   uuid             NOT NULL DEFAULT gen_random_uuid(),
  user_id              uuid             NOT NULL,
  property_id          uuid             NOT NULL,
  credits              double precision NOT NULL,
  description          text             NOT NULL,
  transaction_hash     text             NOT NULL,
  beneficiary_address  text             NOT NULL,
  beneficiary_name     text             NOT NULL,
  created_at           timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT offset_pkey            PRIMARY KEY (id),
  CONSTRAINT offset_user_id_fkey    FOREIGN KEY (user_id)     REFERENCES public.users(id),
  CONSTRAINT offset_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property_data(id)
);

CREATE TABLE public.user_kyc (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  "fullName"      text,
  username        text,
  "phoneNumber"   numeric,
  "documentType"  text,
  "documentNumber" text,
  user_id         uuid,
  "documentImage" text,
  status          boolean     DEFAULT false,
  CONSTRAINT user_kyc_pkey   PRIMARY KEY (id),
  CONSTRAINT fk_user         FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.api_keys (
  id         uuid   NOT NULL DEFAULT gen_random_uuid(),
  access_key text   NOT NULL UNIQUE,
  secret_key text   NOT NULL UNIQUE,
  "limit"    bigint,
  user_id    uuid   NOT NULL UNIQUE,
  CONSTRAINT api_keys_pkey        PRIMARY KEY (id),
  CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- --------------------------------------------------------
-- 3. Token-system tables
-- --------------------------------------------------------

CREATE TABLE public.user_token_balances (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  property_id uuid        NOT NULL,
  token_type  token_type  NOT NULL,
  balance     numeric     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_token_balances_pkey PRIMARY KEY (id),
  CONSTRAINT utb_user_id_fkey        FOREIGN KEY (user_id)     REFERENCES public.users(id),
  CONSTRAINT utb_property_id_fkey    FOREIGN KEY (property_id) REFERENCES public.property_data(id),
  CONSTRAINT utb_unique_balance      UNIQUE (user_id, property_id, token_type)
);

CREATE TABLE public.pool_deposits (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  property_id  uuid        NOT NULL,
  amount       numeric     NOT NULL,
  cit_received numeric     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  withdrawn    boolean     NOT NULL DEFAULT false,
  CONSTRAINT pool_deposits_pkey       PRIMARY KEY (id),
  CONSTRAINT pd_user_id_fkey          FOREIGN KEY (user_id)     REFERENCES public.users(id),
  CONSTRAINT pd_property_id_fkey      FOREIGN KEY (property_id) REFERENCES public.property_data(id)
);

CREATE TABLE public.maturity_events (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  property_id     uuid        NOT NULL,
  percentage      numeric     NOT NULL DEFAULT 0,
  total_pt_burned numeric     NOT NULL,
  total_vcc_minted numeric    NOT NULL,
  tx_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maturity_events_pkey         PRIMARY KEY (id),
  CONSTRAINT me_property_id_fkey          FOREIGN KEY (property_id) REFERENCES public.property_data(id)
);

CREATE TABLE public.available_retirements (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  property_id uuid        NOT NULL,
  available   numeric     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT available_retirements_pkey       PRIMARY KEY (id),
  CONSTRAINT ar_property_id_fkey              FOREIGN KEY (property_id) REFERENCES public.property_data(id),
  CONSTRAINT ar_unique_property               UNIQUE (property_id)
);

CREATE TABLE public.retirement_certificates (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  property_id     uuid        NOT NULL,
  amount          numeric     NOT NULL,
  nft_token_id    bigint,
  tx_hash         text,
  certificate_uri text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retirement_certificates_pkey  PRIMARY KEY (id),
  CONSTRAINT rc_user_id_fkey               FOREIGN KEY (user_id)     REFERENCES public.users(id),
  CONSTRAINT rc_property_id_fkey           FOREIGN KEY (property_id) REFERENCES public.property_data(id)
);

-- --------------------------------------------------------
-- 4. Indexes
-- --------------------------------------------------------
CREATE INDEX idx_owners_user         ON public.owners (user_id);
CREATE INDEX idx_owners_property     ON public.owners (property_id);
CREATE INDEX idx_payments_user       ON public.payments (user_id);
CREATE INDEX idx_payments_property   ON public.payments (property_id);
CREATE INDEX idx_payments_order      ON public.payments (order_id);
CREATE INDEX idx_offset_user         ON public."offset" (user_id);
CREATE INDEX idx_offset_property     ON public."offset" (property_id);
CREATE INDEX idx_user_kyc_user       ON public.user_kyc (user_id);
CREATE INDEX idx_utb_user            ON public.user_token_balances (user_id);
CREATE INDEX idx_utb_property        ON public.user_token_balances (property_id);
CREATE INDEX idx_pool_deposits_user  ON public.pool_deposits (user_id);
CREATE INDEX idx_maturity_property   ON public.maturity_events (property_id);
CREATE INDEX idx_ar_property         ON public.available_retirements (property_id);
CREATE INDEX idx_rc_user             ON public.retirement_certificates (user_id);

-- --------------------------------------------------------
-- 5. Row-Level Security (RLS)
-- --------------------------------------------------------

ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_data            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."offset"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_kyc                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_token_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_deposits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maturity_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_retirements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retirement_certificates  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own row"    ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own row"  ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role full access on users" ON public.users FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read properties" ON public.property_data FOR SELECT USING (true);
CREATE POLICY "Service role manages properties" ON public.property_data FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own ownership" ON public.owners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages owners"  ON public.owners FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages payments" ON public.payments FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own offsets" ON public."offset" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages offsets" ON public."offset" FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own kyc"    ON public.user_kyc FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kyc"   ON public.user_kyc FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages kyc"   ON public.user_kyc FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own api keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages api_keys" ON public.api_keys FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own token balances" ON public.user_token_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages token balances" ON public.user_token_balances FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own pool deposits" ON public.pool_deposits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages pool deposits" ON public.pool_deposits FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read maturity events" ON public.maturity_events FOR SELECT USING (true);
CREATE POLICY "Service role manages maturity events" ON public.maturity_events FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read available retirements" ON public.available_retirements FOR SELECT USING (true);
CREATE POLICY "Service role manages available retirements" ON public.available_retirements FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own certificates" ON public.retirement_certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages certificates" ON public.retirement_certificates FOR ALL USING (auth.role() = 'service_role');

-- --------------------------------------------------------
-- 6. Enable Realtime
-- --------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_token_balances;
