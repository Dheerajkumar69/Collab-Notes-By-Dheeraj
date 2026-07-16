
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Backfill: existing users skip onboarding
UPDATE public.profiles SET onboarded_at = COALESCE(onboarded_at, created_at, now())
  WHERE onboarded_at IS NULL;
