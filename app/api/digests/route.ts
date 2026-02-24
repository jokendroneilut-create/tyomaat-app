// TRACE_VERSION_1
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function summarizeFilters(filters: any): string {
  if (!filters || typeof filters !== "object") return "Ei suodattimia";

  const parts: string[] = [];
  if (filters.q) parts.push(`Haku: ${filters.q}`);
  if (filters.region) parts.push(`Maakunta: ${filters.region}`);
  if (filters.city) parts.push(`Kaupunki: ${filters.city}`);
  if (filters.phase) parts.push(`Vaihe: ${filters.phase}`);
  if (filters.property_type) parts.push(`Kohdetyyppi: ${filters.property_type}`);

  return parts.length ? parts.join(" • ") : "Ei suodattimia";
}

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
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const debug = url.searchParams.get("debug") === "1";

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
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

    const debugRows: any[] = [];

    for (const w of (watches as Watch[]) || []) {
      checked++;

      const due = isDue(w.frequency, w.last_sent_at);
      if (!due) {
        if (debug) {
          debugRows.push({
            watch_id: w.id,
            name: w.name,
            frequency: w.frequency,
            last_sent_at: w.last_sent_at,
            due,
            since: null,
            filters: w.filters,
            projects_found: null,
            note: "Skipped (not due)",
          });
        }
        continue;
      }

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
        if (debug) {
          debugRows.push({
            watch_id: w.id,
            name: w.name,
            frequency: w.frequency,
            last_sent_at: w.last_sent_at,
            due,
            since: since.toISOString(),
            filters: w.filters,
            projects_found: null,
            note: `Projects query error: ${pErr.message}`,
          });
        }
        continue;
      }

      if (debug) {
        debugRows.push({
          watch_id: w.id,
          name: w.name,
          frequency: w.frequency,
          last_sent_at: w.last_sent_at,
          due,
          since: since.toISOString(),
          filters: w.filters,
          projects_found: projects?.length ?? 0,
        });
        continue; // debug-tilassa ei lähetetä eikä päivitetä last_sent_at
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
      const filterSummary = summarizeFilters(w.filters);
      const subject = `Uusia hankkeita (${projects.length}) – ${w.name}`;

      const rowsHtml = projects
        .slice(0, 30)
        .map((p: any) => {
          const meta = [p.city, p.region ?? "-", p.phase].filter(Boolean).join(" • ");
          return `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
                <div style="font-weight:700;color:#111827;">${escapeHtml(p.name)}</div>
                <div style="font-size:13px;color:#6b7280;margin-top:2px;">
                  ${escapeHtml(meta)}
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      const textLines = projects
        .slice(0, 30)
        .map((p: any) => `• ${p.name} – ${p.city} – ${p.region ?? "-"} (${p.phase})`)
        .join("\n");

      const textBody =
        `Hei!\n\n` +
        `Hakuvahti: ${w.name}\n` +
        `Suodattimet: ${filterSummary}\n\n` +
        `Löytyi ${projects.length} uutta hanketta edellisen koonnin jälkeen.\n\n` +
        `${textLines}\n\n` +
        `Avaa Työmaat: ${appBaseUrl}/projects\n` +
        `Hallinnoi hakuvahteja: ${appBaseUrl}/watchlists\n`;

      const htmlBody = `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#f9fafb;padding:24px;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;">
              <div style="font-size:18px;font-weight:800;color:#111827;">Työmaat.fi</div>
              <div style="margin-top:6px;color:#374151;">
                <div style="font-weight:700;">Uusia hankkeita: ${projects.length}</div>
                <div style="font-size:13px;color:#6b7280;margin-top:4px;">Hakuvahti: ${escapeHtml(
                  w.name
                )}</div>
                <div style="font-size:13px;color:#6b7280;margin-top:2px;">Suodattimet: ${escapeHtml(
                  filterSummary
                )}</div>
              </div>
            </div>

            <div style="padding:6px 20px 0 20px;">
              <table style="width:100%;border-collapse:collapse;">
                ${rowsHtml}
              </table>

              ${
                projects.length > 30
                  ? `<div style="font-size:13px;color:#6b7280;margin-top:10px;">
                      Näytetään 30 / ${projects.length}. Avaa palvelu nähdäksesi kaikki.
                     </div>`
                  : ``
              }

              <div style="margin:18px 0 6px 0;">
                <a href="${appBaseUrl}/projects"
                   style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 14px;border-radius:10px;font-weight:800;">
                  Avaa Työmaat
                </a>
              </div>

              <div style="margin:10px 0 18px 0;font-size:13px;color:#6b7280;">
                Hallinnoi hakuvahteja:
                <a href="${appBaseUrl}/watchlists" style="color:#2563eb;text-decoration:none;">
                  ${appBaseUrl}/watchlists
                </a>
              </div>
            </div>
          </div>
        </div>
      `;

      const sendRes = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
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

    if (debug) {
      return NextResponse.json({ ok: true, checked, sent, debugRows });
    }

    return NextResponse.json({ ok: true, checked, sent });
  } catch (err: any) {
    console.error("DIGEST ERROR:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}