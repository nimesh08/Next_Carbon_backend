-- Migration: Rename RTP/SEC/ACC -> PT/CIT/VCC, add new tables, add missing columns
-- Run this on the EXISTING Supabase project

-- 1. Drop dependent objects first
DROP TABLE IF EXISTS public.retirement_certificates CASCADE;
DROP TABLE IF EXISTS public.available_retirements CASCADE;
DROP TABLE IF EXISTS public.maturity_events CASCADE;
DROP TABLE IF EXISTS public.pool_deposits CASCADE;
DROP TABLE IF EXISTS public.user_token_balances CASCADE;

-- 2. Drop and recreate the token_type enum
DROP TYPE IF EXISTS token_type CASCADE;
CREATE TYPE token_type AS ENUM ('PT', 'CIT', 'VCC');

-- 3. Add missing columns to property_data (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_data' AND column_name='maturity_percentage') THEN
    ALTER TABLE public.property_data ADD COLUMN maturity_percentage numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 4. Recreate token-system tables with new naming

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
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  property_id      uuid        NOT NULL,
  percentage       numeric     NOT NULL DEFAULT 0,
  total_pt_burned  numeric     NOT NULL,
  total_vcc_minted numeric     NOT NULL,
  tx_hash          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maturity_events_pkey    PRIMARY KEY (id),
  CONSTRAINT me_property_id_fkey     FOREIGN KEY (property_id) REFERENCES public.property_data(id)
);

CREATE TABLE public.available_retirements (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  property_id uuid        NOT NULL,
  available   numeric     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT available_retirements_pkey  PRIMARY KEY (id),
  CONSTRAINT ar_property_id_fkey         FOREIGN KEY (property_id) REFERENCES public.property_data(id),
  CONSTRAINT ar_unique_property          UNIQUE (property_id)
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

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_utb_user            ON public.user_token_balances (user_id);
CREATE INDEX IF NOT EXISTS idx_utb_property        ON public.user_token_balances (property_id);
CREATE INDEX IF NOT EXISTS idx_pool_deposits_user  ON public.pool_deposits (user_id);
CREATE INDEX IF NOT EXISTS idx_maturity_property   ON public.maturity_events (property_id);
CREATE INDEX IF NOT EXISTS idx_ar_property         ON public.available_retirements (property_id);
CREATE INDEX IF NOT EXISTS idx_rc_user             ON public.retirement_certificates (user_id);

-- 6. RLS
ALTER TABLE public.user_token_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_deposits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maturity_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_retirements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retirement_certificates  ENABLE ROW LEVEL SECURITY;

-- user_token_balances
DROP POLICY IF EXISTS "Users can read own token balances" ON public.user_token_balances;
CREATE POLICY "Users can read own token balances" ON public.user_token_balances FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages token balances" ON public.user_token_balances;
CREATE POLICY "Service role manages token balances" ON public.user_token_balances FOR ALL USING (auth.role() = 'service_role');

-- pool_deposits
DROP POLICY IF EXISTS "Users can read own pool deposits" ON public.pool_deposits;
CREATE POLICY "Users can read own pool deposits" ON public.pool_deposits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages pool deposits" ON public.pool_deposits;
CREATE POLICY "Service role manages pool deposits" ON public.pool_deposits FOR ALL USING (auth.role() = 'service_role');

-- maturity_events
DROP POLICY IF EXISTS "Anyone can read maturity events" ON public.maturity_events;
CREATE POLICY "Anyone can read maturity events" ON public.maturity_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role manages maturity events" ON public.maturity_events;
CREATE POLICY "Service role manages maturity events" ON public.maturity_events FOR ALL USING (auth.role() = 'service_role');

-- available_retirements
DROP POLICY IF EXISTS "Anyone can read available retirements" ON public.available_retirements;
CREATE POLICY "Anyone can read available retirements" ON public.available_retirements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role manages available retirements" ON public.available_retirements;
CREATE POLICY "Service role manages available retirements" ON public.available_retirements FOR ALL USING (auth.role() = 'service_role');

-- retirement_certificates
DROP POLICY IF EXISTS "Users can read own certificates" ON public.retirement_certificates;
CREATE POLICY "Users can read own certificates" ON public.retirement_certificates FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages certificates" ON public.retirement_certificates;
CREATE POLICY "Service role manages certificates" ON public.retirement_certificates FOR ALL USING (auth.role() = 'service_role');

-- 7. Realtime (safe to re-run)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_token_balances;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
