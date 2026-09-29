/**
 * One-off diagnostic for the missing welcome/coupon email after signup.
 *
 * Read-only checks, in order:
 *  1. Env vars present (names only, keys never printed)
 *  2. profiles.welcome_email_sent_at column exists (migration 20260105 run?)
 *  3. Most recent profile rows (did the new signup get a profile?)
 *  4. An active first_order_only coupon exists (the email skips if not)
 *  5. Brevo account is active + sender verified
 *  6. Recent Brevo transactional events (did the welcome email reach Brevo?
 *     was it delivered, bounced, blocked?)
 *
 * Prints statuses and masked data only. Never prints API keys or tokens.
 */
import fs from "node:fs";

// Load .env.local manually (later lines win, like dotenv).
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BREVO_KEY = process.env.BREVO_API_KEY?.trim();

function maskEmail(email) {
  if (!email) return "(null)";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

console.log("=== 1. Env check (names only) ===");
console.log(
  "NEXT_PUBLIC_SUPABASE_URL:",
  SB_URL ? "set" : "MISSING"
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  SB_KEY ? `set (ends ...${SB_KEY.slice(-4)})` : "MISSING"
);
console.log(
  "BREVO_API_KEY:",
  BREVO_KEY ? `set (ends ...${BREVO_KEY.slice(-4)})` : "MISSING"
);

if (!SB_URL || !SB_KEY) {
  console.log(">>> Cannot continue: Supabase env missing.");
  process.exit(1);
}

async function sb(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Accept: "application/json",
    },
  });
  return { status: res.status, body: await res.text() };
}

console.log("\n=== 2. profiles.welcome_email_sent_at column ===");
const colRes = await sb(
  "profiles?select=id,email,welcome_email_sent_at&limit=1"
);
if (colRes.status === 200) {
  console.log("HTTP 200 - column EXISTS (migration 20260105 was run). OK");
} else {
  console.log(`HTTP ${colRes.status} - ${colRes.body.slice(0, 250)}`);
  if (colRes.body.includes("PGRST204")) {
    console.log(
      ">>> ROOT CAUSE FOUND: welcome_email_sent_at column is MISSING." +
        "\n>>> Migration 20260105_welcome_email_flag.sql was NOT run in Supabase." +
        "\n>>> The auth callback silently skips the email when this select fails." +
        "\n>>> FIX: run that SQL in the Supabase SQL editor."
    );
  }
}

console.log("\n=== 3. Most recent profiles (newest first) ===");
const profRes = await sb(
  "profiles?select=id,email,full_name,welcome_email_sent_at,created_at&order=created_at.desc&limit=5"
);
if (profRes.status === 200) {
  const rows = JSON.parse(profRes.body);
  if (rows.length === 0) {
    console.log(
      "NO PROFILE ROWS AT ALL - the on_auth_user_created trigger migration (202609260002_create_profile_trigger.sql) has not been run."
    );
  } else {
    for (const r of rows) {
      console.log(
        `  - ${maskEmail(r.email)} | name: ${r.full_name || "(empty)"} | welcome_email_sent_at: ${
          r.welcome_email_sent_at ?? "null (never sent)"
        } | created: ${r.created_at?.slice(0, 16)}`
      );
    }
  }
} else {
  console.log(`HTTP ${profRes.status} - ${profRes.body.slice(0, 250)}`);
}

console.log("\n=== 4. Active first-order coupon ===");
const cpRes = await sb(
  "coupons?select=code,discount_type,discount_value_cad,first_order_only,active&first_order_only=eq.true&active=eq.true&limit=1"
);
if (cpRes.status === 200) {
  const coupons = JSON.parse(cpRes.body);
  if (coupons.length === 0) {
    console.log(
      ">>> ROOT CAUSE FOUND: no active first_order_only coupon. sendWelcomeEmail() returns false silently in that case." +
        "\n>>> FIX: create/activate a coupon with first_order_only = true in the admin coupons page or DB."
    );
  } else {
    const c = coupons[0];
    console.log(
      `OK - coupon "${c.code}" (${c.discount_type}, value ${c.discount_value_cad}) is active`
    );
  }
} else {
  console.log(`HTTP ${cpRes.status} - ${cpRes.body.slice(0, 250)}`);
}

if (!BREVO_KEY) {
  console.log("\n>>> Skipping Brevo checks: BREVO_API_KEY missing.");
  process.exit(0);
}

console.log("\n=== 5. Brevo account + verified senders ===");
const acctRes = await fetch("https://api.brevo.com/v3/account", {
  headers: { "api-key": BREVO_KEY, accept: "application/json" },
});
if (!acctRes.ok) {
  console.log(`Brevo account HTTP ${acctRes.status} - ${(await acctRes.text()).slice(0, 250)}`);
  if (acctRes.status === 401) console.log(">>> BREVO_API_KEY is invalid or revoked.");
} else {
  const acct = await acctRes.json();
  const planType = acct.plan?.[0]?.type ?? "(none)";
  const credits = acct.credit ?? acct.plan?.[0]?.credits;
  console.log(`HTTP 200 - plan: ${planType}, email credits: ${credits ?? "?"}`);
  if (typeof credits === "number" && credits <= 0) {
    console.log(">>> ZERO email credits - Brevo would refuse every send.");
  }

  const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
    headers: { "api-key": BREVO_KEY, accept: "application/json" },
  });
  if (sendersRes.ok) {
    const senders = (await sendersRes.json()).senders ?? [];
    const arade = senders.filter((s) => (s.email || "").endsWith("aradeshop.com"));
    if (arade.length === 0) {
      console.log(
        ">>> ROOT CAUSE FOUND: no verified sender on aradeshop.com - emails from support@aradeshop.com are rejected."
      );
    } else {
      for (const s of arade) {
        console.log(
          `Sender ${s.email} - ${s.enabled ? "verified/enabled" : "NOT verified"}`
        );
      }
    }
  } else {
    console.log(`Senders check HTTP ${sendersRes.status}`);
  }
}

console.log("\n=== 6. Recent Brevo transactional events (newest 10) ===");
const evRes = await fetch(
  "https://api.brevo.com/v3/smtp/statistics/events?limit=10&sort=desc",
  { headers: { "api-key": BREVO_KEY, accept: "application/json" } }
);
if (!evRes.ok) {
  console.log(`Events HTTP ${evRes.status} - ${(await evRes.text()).slice(0, 250)}`);
} else {
  const events = (await evRes.json()).events ?? [];
  if (events.length === 0) {
    console.log("No transactional events at all - Brevo has not been asked to send anything recently.");
    console.log(">>> If the user clicked the confirm link, the local callback either never ran or exited early (see sections 2-4).");
  } else {
    for (const e of events) {
      console.log(
        `  ${String(e.date || e.time).slice(0, 16)} | ${e.event} | ${maskEmail(e.email)} | subject: ${e.subject ?? "(n/a)"}`
      );
    }
    const welcome = events.filter((e) => (e.subject || "").startsWith("Welcome to Arade"));
    if (welcome.length === 0) {
      console.log(">>> No 'Welcome to Arade' event in the last 10 - the coupon email never reached Brevo.");
    }
  }
}

console.log("\nDone. Nothing above printed any secret.");
