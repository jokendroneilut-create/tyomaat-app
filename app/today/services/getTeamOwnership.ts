import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type TeamOwnership = {
  inTeam: boolean
  // project_id -> owner_id (vain jos assignments haettiin)
  ownerByProject: Map<string, string>
  // owner_id -> näyttönimi
  nameByOwner: Map<string, string>
}

const EMPTY: TeamOwnership = {
  inTeam: false,
  ownerByProject: new Map(),
  nameByOwner: new Map(),
}

/*
 * Käyttäjän tiimikonteksti /today:ta varten. Kevyt oletuksena: haetaan vain
 * kuuluuko käyttäjä tiimiin (inTeam -> ohjaa opt-in-kytkimen näkymisen).
 * Assignments + jäsennimet haetaan vain kun `includeAssignments` (tiimi-moodi
 * päällä), jotta pooli/omistajuus voidaan liittää hankkeisiin.
 */
export async function getTeamOwnership(
  userId: string | null | undefined,
  includeAssignments: boolean
): Promise<TeamOwnership> {
  if (!userId) return EMPTY

  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle()

  const teamId = member?.team_id
  if (!teamId) return EMPTY

  if (!includeAssignments) {
    return { inTeam: true, ownerByProject: new Map(), nameByOwner: new Map() }
  }

  const [{ data: assignments }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from("project_assignments")
      .select("project_id, owner_id")
      .eq("team_id", teamId),
    supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId),
  ])

  const ownerByProject = new Map<string, string>()
  for (const a of assignments ?? []) {
    if (a.owner_id) ownerByProject.set(a.project_id, a.owner_id)
  }

  const memberIds = (members ?? []).map((m) => m.user_id)
  const nameByOwner = new Map<string, string>()

  if (memberIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", memberIds)

    for (const p of profiles ?? []) {
      nameByOwner.set(p.id, p.full_name || p.email || p.id)
    }
  }

  return { inTeam: true, ownerByProject, nameByOwner }
}
