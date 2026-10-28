import { prisma } from "@/lib/prisma";
import { CHAT_USER_SELECT, ONLINE_WINDOW_MS, type ChatActor } from "@/lib/chat";
import type {
  ChatDirectory,
  ChatDirectoryGroup,
  ChatDirectoryGroupInfo,
  ChatDirectoryUser,
  ChatRole,
} from "@/types/chat";

export const STUDENTS_PAGE_SIZE = 60;
const CONTACTS_LIMIT = 200;

export interface ChatDirectoryQuery {
  q?: string;
  groupId?: string | null;
  ungrouped?: boolean;
  offset?: number;
  limit?: number;
}

type DirectoryUserRow = {
  id: string;
  nom: string;
  prenom: string;
  role: string;
  image: string | null;
  lastSeenAt: Date | null;
  email: string;
};

type GroupRow = {
  id: string;
  nom: string;
  matiere: { nom: string } | null;
  prof: { id: string; prenom: string; nom: string } | null;
  _count: { inscriptions: number };
};

function searchFilter(q: string) {
  if (!q) return {};
  return {
    OR: [
      { nom: { contains: q, mode: "insensitive" as const } },
      { prenom: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

function toGroupInfo(group: { id: string; nom: string; matiere: { nom: string } | null }): ChatDirectoryGroupInfo {
  return { id: group.id, nom: group.nom, matiere: group.matiere?.nom ?? null };
}

function serializeDirectoryUser(
  row: DirectoryUserRow,
  groups: ChatDirectoryGroupInfo[],
  groupCount?: number
): ChatDirectoryUser {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    role: row.role as ChatRole,
    email: row.email,
    image: row.image ?? null,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    online: row.lastSeenAt ? Date.now() - row.lastSeenAt.getTime() < ONLINE_WINDOW_MS : false,
    groups,
    ...(groupCount !== undefined ? { groupCount } : {}),
  };
}

/**
 * Annuaire de messagerie : mêmes règles d'accès que la messagerie elle-même.
 *  - admin : professeurs + élèves de son centre, regroupés par groupe ;
 *  - prof  : administration + ses élèves, regroupés par ses groupes ;
 *  - élève : ses professeurs (avec leurs groupes) + l'administration.
 * La recherche et le filtre par groupe sont appliqués côté serveur pour rester
 * fluides même avec plusieurs centaines d'utilisateurs.
 */
export async function getChatDirectory(
  actor: ChatActor,
  query: ChatDirectoryQuery = {}
): Promise<ChatDirectory> {
  const q = (query.q ?? "").trim().slice(0, 80);
  const limit = Math.min(Math.max(Number(query.limit) || STUDENTS_PAGE_SIZE, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const baseUserWhere = {
    centerId: actor.centerId,
    deletedAt: null,
    ghost: false,
  };
  const userOrder = [{ prenom: "asc" as const }, { nom: "asc" as const }];
  const contactsBase = { ...baseUserWhere, ...searchFilter(q) };

  const groupWhere =
    actor.role === "admin"
      ? { centerId: actor.centerId, statut: "actif" as const }
      : actor.role === "prof"
        ? { centerId: actor.centerId, statut: "actif" as const, profId: actor.id }
        : {
            centerId: actor.centerId,
            statut: "actif" as const,
            inscriptions: { some: { eleveId: actor.id, statut: "actif" as const } },
          };

  // Périmètre des élèves : un prof ne voit que les élèves de ses groupes.
  const studentBase = { ...baseUserWhere, role: "eleve" as const };
  const scopedFilters: object[] =
    actor.role === "prof"
      ? [
          {
            inscriptions: {
              some: {
                statut: "actif" as const,
                groupe: { centerId: actor.centerId, profId: actor.id },
              },
            },
          },
        ]
      : [];
  const allowedGroupId = query.groupId || null;
  const filters = [...scopedFilters];
  if (allowedGroupId) {
    filters.push({ inscriptions: { some: { groupeId: allowedGroupId, statut: "actif" } } });
  } else if (query.ungrouped && actor.role === "admin") {
    filters.push({
      inscriptions: {
        none: { statut: "actif", groupe: { centerId: actor.centerId, statut: "actif" } },
      },
    });
  }
  const studentWhere = {
    ...studentBase,
    ...(filters.length ? { AND: filters } : {}),
    ...searchFilter(q),
  };
  const filtered = Boolean(q || allowedGroupId || (query.ungrouped && actor.role === "admin"));

  const groupsPromise = prisma.groupe.findMany({
    where: groupWhere,
    select: {
      id: true,
      nom: true,
      matiere: { select: { nom: true } },
      prof: { select: { id: true, prenom: true, nom: true } },
      _count: { select: { inscriptions: { where: { statut: "actif" } } } },
    },
    orderBy: [{ nom: "asc" }, { id: "asc" }],
  }) as Promise<GroupRow[]>;

  const contactsLabel =
    actor.role === "admin" ? "Professeurs" : actor.role === "prof" ? "Administration" : "Professeurs";

  // Un seul aller-retour pour tous les effectifs (rôles + élèves sans groupe) :
  // sur une base distante, chaque requête de comptage coûte ~150 à 300 ms.
  const countsPromise = prisma.$queryRaw<
    { admins: number; profs: number; eleves: number; ungrouped: number }[]
  >`
    SELECT
      count(*) FILTER (WHERE u."role" = 'admin')::int AS "admins",
      count(*) FILTER (WHERE u."role" = 'prof')::int AS "profs",
      count(*) FILTER (WHERE u."role" = 'eleve')::int AS "eleves",
      count(*) FILTER (
        WHERE u."role" = 'eleve' AND NOT EXISTS (
          SELECT 1
          FROM "inscriptions" i
          JOIN "groupes" g ON g."id" = i."groupe_id"
          WHERE i."eleve_id" = u."id"
            AND i."statut" = 'actif'
            AND g."center_id" = ${actor.centerId}::uuid
            AND g."statut" = 'actif'
        )
      )::int AS "ungrouped"
    FROM "utilisateurs" u
    WHERE u."center_id" = ${actor.centerId}::uuid
      AND u."deleted_at" IS NULL
      AND u."ghost" = false
  `;

  const adminRowsPromise = prisma.utilisateur.findMany({
    where: { ...contactsBase, role: "admin" },
    select: CHAT_USER_SELECT,
    orderBy: userOrder,
    take: CONTACTS_LIMIT,
  }) as Promise<DirectoryUserRow[]>;

  let contacts: ChatDirectoryUser[] = [];
  let totalContacts = 0;
  let groupRows: GroupRow[] = [];
  let eleves: ChatDirectoryUser[] = [];
  let totalStudents = 0;
  let totalEleves = 0;
  let ungroupedCount = 0;
  let hasMore = false;

  if (actor.role === "admin") {
    const [groups, profRows, counts, studentsFiltered, rows] = await Promise.all([
      groupsPromise,
      prisma.utilisateur.findMany({
        where: { ...contactsBase, role: "prof" },
        select: CHAT_USER_SELECT,
        orderBy: userOrder,
        take: CONTACTS_LIMIT,
      }) as Promise<DirectoryUserRow[]>,
      countsPromise,
      filtered ? prisma.utilisateur.count({ where: studentWhere }) : Promise.resolve(0),
      prisma.utilisateur.findMany({
        where: studentWhere,
        select: {
          ...CHAT_USER_SELECT,
          inscriptions: {
            where: {
              statut: "actif",
              groupe: { centerId: actor.centerId, statut: "actif" },
            },
            select: {
              groupe: { select: { id: true, nom: true, matiere: { select: { nom: true } } } },
            },
          },
        },
        orderBy: [...userOrder, { id: "asc" as const }],
        skip: offset,
        take: limit + 1,
      }),
    ]);

    const stats = counts[0] ?? { admins: 0, profs: 0, eleves: 0, ungrouped: 0 };

    groupRows = groups;
    totalContacts = stats.profs;
    contacts = profRows.map((row) => {
      const groupsOfProf = groups.filter((group) => group.prof?.id === row.id).map(toGroupInfo);
      return serializeDirectoryUser(row, groupsOfProf, groupsOfProf.length);
    });
    totalStudents = stats.eleves;
    ungroupedCount = stats.ungrouped;
    totalEleves = filtered ? studentsFiltered : stats.eleves;
    hasMore = rows.length > limit;
    eleves = rows.slice(0, limit).map((row) =>
      serializeDirectoryUser(
        row,
        row.inscriptions.map((inscription) => toGroupInfo(inscription.groupe))
      )
    );
  } else if (actor.role === "prof") {
    const [groups, counts, studentsTotal, studentsFiltered, rows] = await Promise.all([
      groupsPromise,
      countsPromise,
      prisma.utilisateur.count({ where: { ...studentBase, AND: scopedFilters } }),
      filtered ? prisma.utilisateur.count({ where: studentWhere }) : Promise.resolve(0),
      prisma.utilisateur.findMany({
        where: studentWhere,
        select: {
          ...CHAT_USER_SELECT,
          inscriptions: {
            where: {
              statut: "actif",
              groupe: { centerId: actor.centerId, statut: "actif", profId: actor.id },
            },
            select: {
              groupe: { select: { id: true, nom: true, matiere: { select: { nom: true } } } },
            },
          },
        },
        orderBy: [...userOrder, { id: "asc" as const }],
        skip: offset,
        take: limit + 1,
      }),
    ]);

    groupRows = groups;
    totalStudents = studentsTotal;
    totalEleves = filtered ? studentsFiltered : studentsTotal;
    hasMore = rows.length > limit;
    eleves = rows.slice(0, limit).map((row) =>
      serializeDirectoryUser(
        row,
        row.inscriptions.map((inscription) => toGroupInfo(inscription.groupe))
      )
    );

    // L'administration reste joignable, sans être affectée par le filtre élève.
    const adminRows = await adminRowsPromise;
    totalContacts = counts[0]?.admins ?? 0;
    contacts = adminRows.map((row) => serializeDirectoryUser(row, []));
  } else {
    // Élève : ses professeurs (déduits de ses groupes) + l'administration.
    const [groups, adminRows, counts] = await Promise.all([
      groupsPromise,
      adminRowsPromise,
      countsPromise,
    ]);
    groupRows = groups;
    const teacherIds = [
      ...new Set(groups.map((group) => group.prof?.id).filter((id): id is string => Boolean(id))),
    ];
    const teacherRows = teacherIds.length
      ? ((await prisma.utilisateur.findMany({
          where: { ...contactsBase, role: "prof", id: { in: teacherIds } },
          select: CHAT_USER_SELECT,
          orderBy: userOrder,
          take: CONTACTS_LIMIT,
        })) as DirectoryUserRow[])
      : [];
    totalContacts = teacherIds.length + (counts[0]?.admins ?? 0);
    contacts = [
      ...teacherRows.map((row) => {
        const groupsOfProf = groups.filter((group) => group.prof?.id === row.id).map(toGroupInfo);
        return serializeDirectoryUser(row, groupsOfProf, groupsOfProf.length);
      }),
      ...adminRows.map((row) => serializeDirectoryUser(row, [])),
    ];
  }

  const directoryGroups: ChatDirectoryGroup[] = groupRows
    .filter((group) => group._count.inscriptions > 0)
    .map((group) => ({
      id: group.id,
      nom: group.nom,
      matiere: group.matiere?.nom ?? null,
      profId: group.prof?.id ?? null,
      profName: group.prof ? `${group.prof.prenom} ${group.prof.nom}`.trim() : null,
      count: group._count.inscriptions,
    }));

  return {
    role: actor.role as ChatRole,
    contacts,
    contactsLabel,
    groups: actor.role === "eleve" ? [] : directoryGroups,
    eleves,
    totalStudents,
    totalContacts,
    totalEleves,
    ungroupedCount,
    hasMore,
  };
}
