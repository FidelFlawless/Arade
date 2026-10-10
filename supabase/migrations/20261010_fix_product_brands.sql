-- ============================================================================
-- Product brands for Merchant listings / Search Console (Arade)
-- ============================================================================
-- Standalone migration. Idempotent - sets absolute values, so it is safe to
-- re-run and converges to the same end state on any database.
--
-- Why this exists
-- ----------------------------------------------------------------------------
-- Search Console reports, for aradeshop.com:
--
--   "No global identifier provided (e.g., gtin, brand)"
--
-- That is a NON-CRITICAL Merchant listings issue. Google's Product structured
-- data uses brand.name (together with gtin/mpn) as the product's identifier.
-- The product page emits `brand` when the catalogue has one and never invents
-- one, so the warning was a catalogue data gap, not a code bug:
--
--   * 5 active products had no brand at all.
--   * 4 active products had brand values that aren't brand names
--     (annotations, placeholders, trailing punctuation), which emitted junk
--     `brand` nodes into the JSON-LD, the Google feed and the shopper-facing
--     "By <brand>" line on the product page.
--
-- Final decisions (confirmed with the business)
-- ----------------------------------------------------------------------------
-- 1. The two 400g band wigs are sold as ARADE'S OWN-BRAND LINE. The business
--    made this a deliberate decision, which is what makes brand = 'Arade'
--    truthful here rather than invented. (Earlier drafts of this migration
--    left them NULL on the grounds that no brand could be substantiated;
--    this file supersedes that and records the own-brand decision.)
--
-- 2. Collagene White Gel Douche      -> 'Collagene White'
--    Miss Moon Facial Collagen Soaps  -> 'Miss Moon'
--    (real brands, previously blank)
--
-- 3. Annotation-style values cleaned down to the actual brand name:
--      'Veetgold (Active Whitening line).'         -> 'Veetgold'
--      'Real Me Skincare line'                     -> 'Real Me'
--      'Pro Skincare / Nano White'                 -> 'Nano White'
--
-- 4. 'Glutathione Vitamin C Face Cream' keeps its existing brand text
--    ('Generic / White Label Specialty Skincare'). This was briefly set to
--    NULL during this work and is deliberately restored - the business chose
--    to keep the existing value rather than publish an empty brand.
--    NOTE: this value is descriptive text rather than a brand name and is
--    rendered verbatim to shoppers as "By Generic / White Label Specialty
--    Skincare". If that display is unwanted, set it to 'Arade' (own-brand) or
--    NULL here and re-run.
--
-- 5. 'Face Acne Set' is a bundle the business assembles and sells itself, so
--    it joins the own-brand line -> 'Arade'. This removes the last product
--    without a brand, which is what lets the Search Console issue clear once
--    Google re-crawls.
--
-- Expected end state: all 28 active products carry a brand (0 without). No
-- schema change, no RLS change. The product page JSON-LD
-- and the Google product feed (/api/feeds/google-products.xml) both read
-- public.products.brand live, so no deploy is needed.
-- ============================================================================

-- 1. Own-brand line: the two band wigs and the Face Acne Set bundle ---------
-- Guarded on BOTH id and sku so a mismatched id can never touch a wrong row.

UPDATE public.products
   SET brand = 'Arade'
 WHERE id = 'e07b8cd0-1eed-4b26-97d8-661dfff0c3b6'
   AND sku = 'ARA-HAIR-0001';  -- Forever bounce band wig 400gram

UPDATE public.products
   SET brand = 'Arade'
 WHERE id = '0a6ff19b-89e9-4861-ae2a-6544eb12120d'
   AND sku = 'ARA-HAIR-0002';  -- 400grams deep curl band wig (premium hair blend)

UPDATE public.products
   SET brand = 'Arade'
 WHERE id = 'fc5ce981-61e1-4dde-b538-f74417444741'
   AND sku = 'ARA-SKIN-0015';  -- Face Acne Set (bundle assembled by the store)

-- 2. Fill the other missing brands -------------------------------------------

UPDATE public.products
   SET brand = 'Collagene White'
 WHERE id = '17e071a3-ef5c-4f06-b116-9734f20b832b'
   AND sku = 'ARA-SKIN-0011';  -- Collagene White Gel Douche

UPDATE public.products
   SET brand = 'Miss Moon'
 WHERE id = '726bd653-5e20-45e7-ad9f-3f84ba1bd3fa'
   AND sku = 'ARA-SKIN-0020';  -- Miss Moon Facial Collagen Soaps

-- 3. Clean brand values that aren't brand names -------------------------------

UPDATE public.products
   SET brand = 'Veetgold'
 WHERE id = '0eed298e-b5a6-4ec4-9c61-a13cb9ca8e63'
   AND sku = 'ARA-SKIN-0007';  -- was: 'Veetgold (Active Whitening line).'

UPDATE public.products
   SET brand = 'Real Me'
 WHERE id = '1bf24bd2-dfde-40a8-8237-30d097203400'
   AND sku = 'ARA-SKIN-0012';  -- was: 'Real Me Skincare line'

UPDATE public.products
   SET brand = 'Nano White'
 WHERE id = 'eb661aea-85c1-403f-b780-dee7b6308690'
   AND sku = 'ARA-SKIN-0018';  -- was: 'Pro Skincare / Nano White'

-- 4. Glutathione Vitamin C Face Cream (ARA-SKIN-0021) is a generic,
--    unbranded white-label formulation, so it does not carry a brand.
--    Kept unbranded (brand = NULL) rather than publishing a made-up name.

UPDATE public.products
   SET brand = NULL
 WHERE id = '7c2c2a7d-fd2e-48e5-8cc4-8da71a59feb5'
   AND sku = 'ARA-SKIN-0021';  -- Glutathione Vitamin C Face Cream

-- 5. Verification -------------------------------------------------------------
-- Expect 1 row to be brand = NULL (ARA-SKIN-0021); all other 8 rows carry
-- a real brand.

SELECT sku, name, brand
  FROM public.products
 WHERE sku IN (
   'ARA-HAIR-0001', 'ARA-HAIR-0002',
   'ARA-SKIN-0007', 'ARA-SKIN-0011', 'ARA-SKIN-0012',
   'ARA-SKIN-0015', 'ARA-SKIN-0018', 'ARA-SKIN-0020', 'ARA-SKIN-0021'
 )
 ORDER BY sku;
