-- ============================================================================
-- Canada Post label artifacts: PDF vs ZPL (Arade)
-- ============================================================================
-- Standalone migration. Safe to re-run (idempotent). Run in the Supabase SQL
-- Editor BEFORE deploying the code that writes these columns.
--
-- Why two columns: a shipment has ONE artifact URL, and Canada Post
-- content-negotiates on the Accept header —
--     Accept: application/pdf -> the PDF artifact
--     Accept: application/zpl -> the printable 4x6 label (ZPL II)
--     (no Accept header       -> 406 Not Acceptable)
--
-- For the [Test] app this account is on, the PDF artifact is a deposit
-- summary, while the ZPL is the actual printable label. Both are therefore
-- stored so the admin can always print something useful and nothing has to be
-- re-fetched from Canada Post later.
-- ============================================================================

-- ZPL artifact URL (the printable label). Same URL as label_url in practice;
-- kept separate so a future API that publishes distinct URLs needs no change.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS label_zpl_url text;

-- What the PDF at label_url actually is:
--   'label'           - a real parcel label (production accounts)
--   'deposit_summary' - the deposit summary / manifest document of a [Test] app
--   'unverified'      - nothing contradicts it being a label, but the tracking
--                       PIN was not found in the document
-- NULL means "created before this migration" — the UI treats it as a deposit
-- summary, since that is what this account's PDF artifact has always been.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS label_pdf_kind text;

COMMENT ON COLUMN public.orders.label_url IS
  'Canada Post artifact URL (Accept: application/pdf). Deposit summary for [Test] apps.';
COMMENT ON COLUMN public.orders.label_zpl_url IS
  'Same artifact URL for the printable label (Accept: application/zpl).';
COMMENT ON COLUMN public.orders.label_pdf_kind IS
  'label | deposit_summary | unverified — what the PDF at label_url is.';

GRANT ALL ON public.orders TO service_role;
