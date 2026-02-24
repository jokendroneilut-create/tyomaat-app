import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ✅ estää buildin "collect page data" -optimoinnit tälle reitille
export const revalidate = 0;

type Watch = {
  id: string;
  user_id: string;
  name: string;
  filters: any;
  frequency: "daily" | "weekly";
  is_enabled: boolean;
  last_sent_at: string | null;
};

function isDue(freq: "daily" | "weekly", lastSentAt: string | null) {
  if (!lastSentAt) return true;
  const last = new Date(lastSentAt).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const delta = freq === "daily" ? day : 7 * day;
  return now - last >= delta;
}

function applyProjectFilters(q: any, filters: any) {
  if (!filters || typeof filters !== "object") return q;

  if (filters.region) q = q.eq("region", filters.region);
  if (filters.city) q = q.eq("city", filters.city);
  if (filters.phase) q = q.eq("phase", filters.phase);
  if (filters.property_type) q = q.eq("property_type", filters.property_type);

  if (filters.q && typeof filters.q === "string" && filters.q.trim()) {
    const needle = filters.q.trim().replaceAll('"', '\\"');
    q = q.or(
      `name.ilike."%${needle}%",developer.ilike."%${needle}%",builder.ilike."%${needle}%"`
    );
  }
  return q;
}

export async function GET(req: Request) {
  try {
    // ✅ suojaa endpoint
    const secret = new URL(req.url).searchParams.get("secret");
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // ✅ luetaan envit vasta requestissä (ei build-vaiheessa)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
    if (!resendKey) {
      return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendKey);

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const fromEmail = process.env.MAIL_FROM || "onboarding@resend.dev";

    const { data: watches, error: wErr } = await supabase
      .from("saved_searches")
      .select("id,user_id,name,filters,frequency,is_enabled,last_sent_at")
      .eq("is_enabled", true);

    if (wErr) {
      return NextResponse.json({ error: wErr.message }, { status: 500 });
    }

    let checked = 0;
    let sent = 0;

    for (const w of (watches as Watch[]) || []) {
      checked++;

      if (!isDue(w.frequency, w.last_sent_at)) continue;

      const since = w.last_sent_at
        ? new Date(w.last_sent_at)
        : new Date(Date.now() - (w.frequency === "daily" ? 24 : 7) * 60 * 60 * 1000);

      let q = supabase
        .from("projects")
        .select("id,name,city,region,phase,created_at")
        .eq("is_public", true)
        .gt("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      q = applyProjectFilters(q, w.filters);

      const { data: projects, error: pErr } = await q;
      if (pErr) {
        console.error("PROJECTS QUERY ERROR:", pErr);
        continue;
      }

      if (!projects || projects.length === 0) {
        const { error: upErr } = await supabase
          .from("saved_searches")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", w.id);
        if (upErr) console.error("UPDATE last_sent_at ERROR:", upErr);
        continue;
      }

      const { data: userData, error: uErr } = await supabase.auth.admin.getUserById(w.user_id);
      if (uErr || !userData?.user?.email) {
        console.error("ADMIN getUserById ERROR:", uErr);
        continue;
      }

      const email = userData.user.email;
      const subject = `Uusia hankkeita (${projects.length}) – ${w.name}`;

      const lines = projects
        .slice(0, 30)
        .map((p: any) => `• ${p.name} – ${p.city} – ${p.region ?? "-"} (${p.phase})`)
        .join("\n");

      const body =
        `Hei!\n\n` +
        `Hakuvahti: ${w.name}\n` +
        `Löytyi ${projects.length} uutta hanketta edellisen koonnin jälkeen.\n\n` +
        `${lines}\n\n` +
        `Avaa Työmaat: ${appBaseUrl}/projects\n\n` +
        `Voit hallita hakuvahteja: ${appBaseUrl}/watchlists\n`;

      const sendRes = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        text: body,
      });

      if ((sendRes as any)?.error) {
        console.error("RESEND SEND ERROR:", (sendRes as any).error);
        continue;
      }

      const { error: upErr2 } = await supabase
        .from("saved_searches")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", w.id);
      if (upErr2) console.error("UPDATE last_sent_at ERROR:", upErr2);

      sent++;
    }

    return NextResponse.json({ ok: true, checked, sent });
  } catch (err: any) {
    console.error("DIGEST ERROR:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}