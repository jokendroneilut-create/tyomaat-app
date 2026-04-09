// TRACE_VERSION_3
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const ROUTE_VERSION = "trace-v3-2026-03-06";

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

type ProjectRow = {
  id: string;
  name: string;
  city: string;
  region: string | null;
  phase: string;
  created_at?: string | null;
};

type UpdatedProjectRow = {
  id: string;
  name: string;
  city: string;
  region: string | null;
  phase: string;
  changed_fields: string[];
  changed_at: string;
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

function applyProjectChangeFilters(q: any, filters: any) {
  if (!filters || typeof filters !== "object") return q;

  if (filters.region) q = q.eq("after->>region", filters.region);
  if (filters.city) q = q.eq("after->>city", filters.city);
  if (filters.phase) q = q.eq("after->>phase", filters.phase);
  if (filters.property_type) q = q.eq("after->>property_type", filters.property_type);

  return q;
}

function buildNewProjectsRowsHtml(projects: ProjectRow[], appBaseUrl: string) {
  return projects
    .slice(0, 30)
    .map((p) => {
      const meta = [p.city, p.region ?? "-", p.phase].filter(Boolean).join(" • ")
      const projectUrl = `${appBaseUrl}/projects?open=${encodeURIComponent(p.id)}`

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:700;color:#111827;">
              <a href="${projectUrl}" style="color:#111827;text-decoration:none;">
                ${escapeHtml(p.name)}
              </a>
            </div>
            <div style="font-size:13px;color:#6b7280;margin-top:2px;">
              ${escapeHtml(meta)}
            </div>
            <div style="margin-top:8px;">
              <a
                href="${projectUrl}"
                style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:700;"
              >
                Avaa hanke
              </a>
            </div>
          </td>
        </tr>
      `
    })
    .join("")
}

function buildNewProjectsTextLines(projects: ProjectRow[], appBaseUrl: string) {
  return projects
    .slice(0, 30)
    .map((p) => {
      const projectUrl = `${appBaseUrl}/projects?open=${encodeURIComponent(p.id)}`
      return `• ${p.name} – ${p.city} – ${p.region ?? "-"} (${p.phase})\n  ${projectUrl}`
    })
    .join("\n")
}

function buildUpdatedProjectsRowsHtml(updatedOnly: UpdatedProjectRow[], appBaseUrl: string) {
  return updatedOnly
    .slice(0, 30)
    .map((p) => {
      const meta = [p.city, p.region ?? "-", p.phase].filter(Boolean).join(" • ")
      const fields =
        (p.changed_fields ?? []).length > 0
          ? `Päivitys: ${(p.changed_fields as string[]).map(humanizeField).join(", ")}`
          : "Päivitys"
      const projectUrl = `${appBaseUrl}/projects?open=${encodeURIComponent(p.id)}`

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:700;color:#111827;">
              <a href="${projectUrl}" style="color:#111827;text-decoration:none;">
                ${escapeHtml(p.name)}
              </a>
            </div>
            <div style="font-size:13px;color:#6b7280;margin-top:2px;">
              ${escapeHtml(meta)}
            </div>
            <div style="font-size:12px;color:#b45309;margin-top:6px;font-weight:700;">
              ${escapeHtml(fields)}
            </div>
            <div style="margin-top:8px;">
              <a
                href="${projectUrl}"
                style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:700;"
              >
                Avaa hanke
              </a>
            </div>
          </td>
        </tr>
      `
    })
    .join("")
}

function buildUpdatedProjectsTextLines(updatedOnly: UpdatedProjectRow[], appBaseUrl: string) {
  return updatedOnly
    .slice(0, 30)
    .map((p) => {
      const fields =
        (p.changed_fields ?? []).length > 0
          ? ` | Päivitys: ${(p.changed_fields as string[]).map(humanizeField).join(", ")}`
          : ""
      const projectUrl = `${appBaseUrl}/projects?open=${encodeURIComponent(p.id)}`
      return `• ${p.name} – ${p.city} – ${p.region ?? "-"} (${p.phase})${fields}\n  ${projectUrl}`
    })
    .join("\n")
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const debug = url.searchParams.get("debug") === "1";
    const trace = url.searchParams.get("trace") === "1";
    const force = url.searchParams.get("force") === "1";

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "unauthorized", routeVersion: ROUTE_VERSION },
        { status: 401 }
      );
    }

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
        : new Date(Date.now() - (w.frequency === "daily" ? 24 : 7) * 24 * 60 * 60 * 1000);

      let q = supabase
        .from("projects")
        .select("id,name,city,region,phase,created_at")
        .eq("is_public", true)
        .gt("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      q = applyProjectFilters(q, w.filters);

      let cq = supabase
        .from("project_changes")
        .select("project_id,changed_at,changed_fields,after")
        .gt("changed_at", since.toISOString())
        .order("changed_at", { ascending: false });

      cq = applyProjectChangeFilters(cq, w.filters);

      const { data: newProjectsRaw, error: pErr } = await q;
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
            projects_found: (newProjectsRaw as any[])?.length ?? 0,
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
            projects_found: (newProjectsRaw as any[])?.length ?? 0,
            updates_found: null,
            note: `Changes query error: ${cErr.message}`,
          });
        }
        continue;
      }

      const newProjects: ProjectRow[] = ((newProjectsRaw as ProjectRow[]) ?? []).map((p) => ({
        id: p.id,
        name: String(p.name ?? ""),
        city: String(p.city ?? ""),
        region: p.region ?? null,
        phase: String(p.phase ?? ""),
        created_at: p.created_at ?? null,
      }));

      const updatedProjects: UpdatedProjectRow[] = ((changeRows as any[]) ?? []).map((r: any) => ({
        id: r.project_id,
        name: String(r.after?.name ?? "(nimetön)"),
        city: String(r.after?.city ?? ""),
        region: r.after?.region ?? null,
        phase: String(r.after?.phase ?? ""),
        changed_fields: Array.isArray(r.changed_fields) ? r.changed_fields : [],
        changed_at: String(r.changed_at ?? ""),
      }));

      const newIds = new Set(newProjects.map((p) => p.id));
      const updatedOnly = updatedProjects.filter((p) => !newIds.has(p.id));

      const hasNew = newProjects.length > 0;
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
          projects_found: newProjects.length,
          updates_found: updatedOnly.length,
          note: "Debug (no send)",
        });
        continue;
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
            updates_found: updatedOnly.length,
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

      const rowsHtml = buildNewProjectsRowsHtml(newProjects, appBaseUrl);
const textLines = buildNewProjectsTextLines(newProjects, appBaseUrl);
const updatesRowsHtml = buildUpdatedProjectsRowsHtml(updatedOnly, appBaseUrl);
const updatesTextLines = buildUpdatedProjectsTextLines(updatedOnly, appBaseUrl);

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

      if (trace) {
        traceRows.push({
          watch_id: w.id,
          name: w.name,
          email,
          due,
          since: since.toISOString(),
          projects_found: newProjects.length,
          updates_found: updatedOnly.length,
          note: "Will send digest",
        });
      }

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
            updates_found: updatedOnly.length,
            note: `Resend error: ${sendError?.message || JSON.stringify(sendError)}`,
          });
        }
        continue;
      }

      const { error: upErr2 } = await supabase
        .from("saved_searches")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", w.id);

      if (upErr2) {
        console.error("UPDATE last_sent_at ERROR:", upErr2);
      }

      sent++;

      if (trace) {
        traceRows.push({
          watch_id: w.id,
          name: w.name,
          email,
          due,
          since: since.toISOString(),
          projects_found: newProjects.length,
          updates_found: updatedOnly.length,
          note: "Sent OK",
        });
      }
    }

    if (debug) {
      return NextResponse.json({
        ok: true,
        checked,
        sent,
        debugRows,
        routeVersion: ROUTE_VERSION,
      });
    }

    if (trace) {
      return NextResponse.json({
        ok: true,
        checked,
        sent,
        traceRows,
        routeVersion: ROUTE_VERSION,
      });
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