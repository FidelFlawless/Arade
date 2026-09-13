-- Abandoned cart tracking table
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  cart_total numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'CAD',
  last_active timestamptz DEFAULT now(),
  email_sent boolean DEFAULT false,
  email_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for the cron job query (find unsent carts older than 3 hours)
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_check
  ON abandoned_carts (email_sent, last_active)
  WHERE email_sent = false;

-- Index for upsert by user
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user
  ON abandoned_carts (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own abandoned carts
DROP POLICY IF EXISTS "Users read own abandoned carts" ON abandoned_carts;
CREATE POLICY "Users read own abandoned carts"
  ON abandoned_carts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role handles all inserts/updates (via API routes)
DROP POLICY IF EXISTS "Service role manages abandoned carts" ON abandoned_carts;
CREATE POLICY "Service role manages abandoned carts"
  ON abandoned_carts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
