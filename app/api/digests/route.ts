// TRACE_VERSION_2
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const ROUTE_VERSION = "trace-v2-2026-02-24";

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
function humanizeField(field: string): string {
  const map: Record<string, string> = {
    name: "Nimi",
    city: "Kaupunki",
    region: "Maakunta",
    phase: "Vaihe",
    location: "Sijainti",
    developer: "Rakennuttaja",
    builder: "Rakennusliike",
    property_type: "Kohdetyyppi",
    apartments: "Asuntojen määrä",
    floor_area: "Kerrosala",
    estimated_cost: "Arvioitu kustannus",
    construction_start: "Rakentamisen aloitus",
    additional_info: "Lisätietoja",
  };

  return map[field] ?? field;
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
    const debug = url.searchParams.get("debug") === "1"; // ei lähetä, vain raportoi
    const trace = url.searchParams.get("trace") === "1"; // yrittää lähettää ja raportoi

    if (!secret || secret !== process.env.CRON_SECRET) {
  return NextResponse.json(
    { error: "unauthorized", routeVersion: ROUTE_VERSION },
    { status: 401 }
  );
}

    // luetaan envit vasta requestissä
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL", routeVersion: ROUTE_VERSION },
        { status: 500 }
      );
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY", routeVersion: ROUTE_VERSION },
        { status: 500 }
      );
    }
    if (!resendKey) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY", routeVersion: ROUTE_VERSION },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: wErr.message, routeVersion: ROUTE_VERSION },
        { status: 500 }
      );
    }

    let checked = 0;
    let sent = 0;

    const debugRows: any[] = [];
    const traceRows: any[] = [];

    for (const w of (watches as Watch[]) || []) {
      checked++;

      const force = url.searchParams.get("force") === "1";
const due = force ? true : isDue(w.frequency, w.last_sent_at);

      if (!due) {
        if (debug) {
          debugRows.push({
            watch_id: w.id,
            name: w.name,
            frequency: w.frequency,
            last_sent_at: w.last_sent_at,
            due,
            note: "Skipped (not due)",
          });
        }
        if (trace) {
          traceRows.push({
            watch_id: w.id,
            name: w.name,
            frequency: w.frequency,
            last_sent_at: w.last_sent_at,
            due,
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
// ✅ Päivitykset: projektit joita on muokattu "since" jälkeen
let cq = supabase
  .from("project_changes")
  .select("project_id,changed_at,changed_fields,after")
  .gt("changed_at", since.toISOString())
  .order("changed_at", { ascending: false });

// Suodatetaan päivitykset vahdin filttereillä käyttämällä "after"-snapshotia
cq = applyProjectChangeFilters(cq, w.filters);

// 1) Uudet projektit
const { data: newProjects, error: pErr } = await q;

if (pErr) {
  console.error("PROJECTS QUERY ERROR:", pErr);

  if (debug) {
    debugRows.push({
      watch_id: w.id,
      name: w.name,
      due,
      since: since.toISOString(),
      filters: w.filters,
      projects_found: null,
      updates_found: null,
      note: `Projects query error: ${pErr.message}`,
    });
  }
  if (trace) {
    traceRows.push({
      watch_id: w.id,
      name: w.name,
      due,
      since: since.toISOString(),
      filters: w.filters,
      projects_found: null,
      updates_found: null,
      note: `Projects query error: ${pErr.message}`,
    });
  }
  continue;
}

// 2) Päivitykset (project_changes)
const { data: changeRows, error: cErr } = await cq;

if (cErr) {
  console.error("CHANGES QUERY ERROR:", cErr);

  if (debug) {
    debugRows.push({
      watch_id: w.id,
      name: w.name,
      due,
      since: since.toISOString(),
      filters: w.filters,
      projects_found: (newProjects as any[])?.length ?? 0,
      updates_found: null,
      note: `Changes query error: ${cErr.message}`,
    });
  }
  if (trace) {
    traceRows.push({
      watch_id: w.id,
      name: w.name,
      due,
      since: since.toISOString(),
      filters: w.filters,
      projects_found: (newProjects as any[])?.length ?? 0,
      updates_found: null,
      note: `Changes query error: ${cErr.message}`,
    });
  }
  continue;
}

// Muotoile päivitykset projekteiksi (käytetään 'after' snapshotia)
const updatedProjects =
  (changeRows ?? []).map((r: any) => ({
    id: r.project_id,
    name: r.after?.name ?? "(nimetön)",
    city: r.after?.city ?? "",
    region: r.after?.region ?? null,
    phase: r.after?.phase ?? "",
    changed_fields: r.changed_fields ?? [],
    changed_at: r.changed_at,
  })) ?? [];

// Vältä tuplia: jos projekti on sekä “uusi” että “päivitetty”, pidä se uutena (ja tiputa päivityksistä)
const newIds = new Set(((newProjects as any[]) ?? []).map((p: any) => p.id));
const updatedOnly = updatedProjects.filter((p: any) => !newIds.has(p.id));

const hasNew = ((newProjects as any[]) ?? []).length > 0;
const hasUpdates = updatedOnly.length > 0;

if (debug) {
  debugRows.push({
    watch_id: w.id,
    name: w.name,
    frequency: w.frequency,
    last_sent_at: w.last_sent_at,
    due,
    since: since.toISOString(),
    filters: w.filters,
    projects_found: ((newProjects as any[]) ?? []).length,
    updates_found: updatedOnly.length,
    note: "Debug (no send)",
  });
  continue; // debug-tilassa ei lähetetä eikä päivitetä last_sent_at
}

if (!hasNew && !hasUpdates) {
  if (trace) {
    traceRows.push({
      watch_id: w.id,
      name: w.name,
      due,
      since: since.toISOString(),
      filters: w.filters,
      projects_found: 0,
      updates_found: 0,
      note: "No new or updates -> skipped (last_sent_at not changed)",
    });
  }
  continue;
}

if (trace) {
  traceRows.push({
    watch_id: w.id,
    name: w.name,
    due,
    since: since.toISOString(),
    filters: w.filters,
    projects_found: ((newProjects as any[]) ?? []).length,
    updates_found: updatedOnly.length,
    note: "Will send digest",
  });
}

      // Haetaan käyttäjän email adminilla (service role key tarvitaan)
      const { data: userData, error: uErr } = await supabase.auth.admin.getUserById(w.user_id);
      if (uErr || !userData?.user?.email) {
        console.error("ADMIN getUserById ERROR:", uErr);

        if (trace) {
          traceRows.push({
            watch_id: w.id,
            name: w.name,
            due,
            since: since.toISOString(),
            filters: w.filters,
            projects_found: newProjects.length,
            note: `User email missing / admin error: ${uErr?.message || "no email"}`,
          });
        }
        continue;
      }

      const email = userData.user.email;
      const filterSummary = summarizeFilters(w.filters);
      const subject =
  updatedOnly.length > 0
    ? `Uusia hankkeita (${newProjects.length}) + päivityksiä (${updatedOnly.length}) – ${w.name}`
    : `Uusia hankkeita (${newProjects.length}) – ${w.name}`;

      const rowsHtml = newProjects
        const updatesRowsHtml = updatedOnly
  .slice(0, 30)
  .map((p: any) => {
    const meta = [p.city, p.region ?? "-", p.phase].filter(Boolean).join(" • ");
    const fields =
  (p.changed_fields ?? []).length > 0
    ? `Päivitys: ${(p.changed_fields as string[])
        .map(humanizeField)
        .join(", ")}`
    : "Päivitys";
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-weight:700;color:#111827;">${escapeHtml(p.name)}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:2px;">
                ${escapeHtml(meta)}
              </div>
              <div style="font-size:12px;color:#b45309;margin-top:6px;font-weight:700;">
                ${escapeHtml(fields)}
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  })
  .join("");

const updatesTextLines = updatedOnly
  .slice(0, 30)
  .map((p: any) => {
    const fields =
  (p.changed_fields ?? []).length > 0
    ? ` | Päivitys: ${(p.changed_fields as string[])
        .map(humanizeField)
        .join(", ")}`
    : "";
    return `• ${p.name} – ${p.city} – ${p.region ?? "-"} (${p.phase})${fields}`;
  })
  .join("\n");

      const textLines = newProjects
        .slice(0, 30)
        .map((p: any) => `• ${p.name} – ${p.city} – ${p.region ?? "-"} (${p.phase})`)
        .join("\n");

      const textBody =
        `Hei!\n\n` +
        `Hakuvahti: ${w.name}\n` +
        `Suodattimet: ${filterSummary}\n\n` +
        `Löytyi ${newProjects.length} uutta hanketta edellisen koonnin jälkeen.\n\n` +
`${textLines}\n\n` +
(updatedOnly.length > 0
  ? `Lisäksi löytyi ${updatedOnly.length} päivitystä olemassa oleviin hankkeisiin:\n\n${updatesTextLines}\n\n`
  : ``) +
        `Avaa Työmaat: ${appBaseUrl}/projects\n` +
        `Hallinnoi hakuvahteja: ${appBaseUrl}/watchlists\n`;

      const htmlBody = `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#f9fafb;padding:24px;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;">
              <div style="font-size:18px;font-weight:800;color:#111827;">Tyomaat.fi</div>
              <div style="margin-top:6px;color:#374151;">
                <div style="font-weight:700;">Uusia hankkeita: ${newProjects.length}</div>
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
  updatedOnly.length > 0
    ? `
      <div style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:14px;">
        <div style="font-weight:800;color:#111827;margin-bottom:6px;">
          Päivitykset (${updatedOnly.length})
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${updatesRowsHtml}
        </table>
        ${
          updatedOnly.length > 30
            ? `<div style="font-size:13px;color:#6b7280;margin-top:10px;">
                Näytetään 30 / ${updatedOnly.length}. Avaa palvelu nähdäksesi kaikki.
               </div>`
            : ``
        }
      </div>
    `
    : ``
}

              ${
                newProjects.length > 30
                  ? `<div style="font-size:13px;color:#6b7280;margin-top:10px;">
                      Näytetään 30 / ${newProjects.length}. Avaa palvelu nähdäksesi kaikki.
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

      const sendError = (sendRes as any)?.error;
      if (sendError) {
        console.error("RESEND SEND ERROR:", sendError);

        if (trace) {
          traceRows.push({
            watch_id: w.id,
            name: w.name,
            email,
            due,
            since: since.toISOString(),
            projects_found: newProjects.length,
            note: `Resend error: ${sendError?.message || JSON.stringify(sendError)}`,
          });
        }
        continue;
      }

      const { error: upErr2 } = await supabase
        .from("saved_searches")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", w.id);
      if (upErr2) console.error("UPDATE last_sent_at ERROR:", upErr2);

      sent++;

      if (trace) {
        traceRows.push({
          watch_id: w.id,
          name: w.name,
          email,
          due,
          since: since.toISOString(),
          projects_found: newProjects.length,
          note: "Sent OK",
        });
      }
    }

    if (debug) {
      return NextResponse.json({ ok: true, checked, sent, debugRows, routeVersion: ROUTE_VERSION });
    }

    if (trace) {
      return NextResponse.json({ ok: true, checked, sent, traceRows, routeVersion: ROUTE_VERSION });
    }

    return NextResponse.json({ ok: true, checked, sent, routeVersion: ROUTE_VERSION });
  } catch (err: any) {
    console.error("DIGEST ERROR:", err);
    return NextResponse.json(
      { error: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500 }
    );
  }
}
function applyProjectChangeFilters(q: any, filters: any) {
  // "after" on jsonb, joten suodatetaan sitä vasten
  if (!filters) return q;

  if (filters.q) {
    // kevyt: haetaan myöhemmin tarkempi osuma (tässä vain jätetään pois)
    // voit halutessa toteuttaa tekstihaku myöhemmin
  }

  if (filters.region) q = q.eq("after->>region", filters.region);
  if (filters.city) q = q.eq("after->>city", filters.city);
  if (filters.phase) q = q.eq("after->>phase", filters.phase);
  if (filters.property_type) q = q.eq("after->>property_type", filters.property_type);

  return q;
}