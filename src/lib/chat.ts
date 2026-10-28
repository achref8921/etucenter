import { prisma } from "@/lib/prisma";
import type { ChatRole, ChatUser } from "@/types/chat";

export const CHAT_ROLES = ["admin", "prof", "eleve"] as const;
export const MAX_MESSAGE_LENGTH = 2000;
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export interface ChatActor {
  id: string;
  role: string;
  centerId: string;
}

export function chatActorFromSession(session: unknown): ChatActor | null {
  const user = (session as { user?: Record<string, unknown> } | null)?.user;
  if (!user?.id || !user?.centerId) return null;
  const role = String(user.role || "");
  if (!(CHAT_ROLES as readonly string[]).includes(role)) return null;
  return { id: String(user.id), role, centerId: String(user.centerId) };
}

export const CHAT_USER_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  role: true,
  image: true,
  lastSeenAt: true,
  email: true,
} as const;

type SelectedUser = {
  id: string;
  nom: string;
  prenom: string;
  role: string;
  image: string | null;
  lastSeenAt: Date | null;
  email: string;
};

export function serializeChatUser(user: SelectedUser, includeEmail = false): ChatUser {
  return {
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role as ChatRole,
    ...(includeEmail ? { email: user.email } : {}),
    image: user.image ?? null,
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    online: user.lastSeenAt ? Date.now() - user.lastSeenAt.getTime() < ONLINE_WINDOW_MS : false,
  };
}

export function pairKeyFor(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join(":");
}

/**
 * Vérifie qu'un utilisateur a le droit d'écrire à un autre.
 * Règles métier :
 *  - élève  -> ses professeurs (groupes où il est inscrit) + les admins du centre ;
 *  - prof   -> ses élèves (groupes qu'il enseigne) + les admins du centre ;
 *  - admin  -> les professeurs et les élèves de son centre.
 * Aucun échange entre centres ni avec un compte archivé / fantôme.
 */
export async function resolveChatTarget(
  actor: ChatActor,
  targetId: string
): Promise<ChatUser | null> {
  if (!targetId || targetId === actor.id) return null;

  const target = await prisma.utilisateur.findFirst({
    where: {
      id: targetId,
      centerId: actor.centerId,
      deletedAt: null,
      ghost: false,
      role: { not: "super_admin" },
    },
    select: CHAT_USER_SELECT,
  });

  if (!target) return null;

  if (actor.role === "admin") {
    if (target.role !== "prof" && target.role !== "eleve") return null;
    return serializeChatUser(target, true);
  }

  if (actor.role === "eleve") {
    if (target.role === "admin") return serializeChatUser(target, true);
    if (target.role !== "prof") return null;

    const teachesMe = await prisma.groupe.count({
      where: {
        centerId: actor.centerId,
        profId: target.id,
        inscriptions: { some: { eleveId: actor.id, statut: "actif" } },
      },
    });
    return teachesMe > 0 ? serializeChatUser(target, true) : null;
  }

  if (actor.role === "prof") {
    if (target.role === "admin") return serializeChatUser(target, true);
    if (target.role !== "eleve") return null;

    const isMyStudent = await prisma.inscription.count({
      where: {
        eleveId: target.id,
        statut: "actif",
        groupe: { centerId: actor.centerId, profId: actor.id },
      },
    });
    return isMyStudent > 0 ? serializeChatUser(target, true) : null;
  }

  return null;
}

export interface ContactResult extends ChatUser {
  email: string;
}

/**
 * Contacts autorisés pour l'utilisateur courant, éventuellement filtrés par
 * une recherche (nom, prénom ou email).
 */
export async function listChatContacts(actor: ChatActor, query = ""): Promise<ContactResult[]> {
  const q = query.trim().slice(0, 80);
  const search = q
    ? {
        OR: [
          { nom: { contains: q, mode: "insensitive" as const } },
          { prenom: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const base = {
    centerId: actor.centerId,
    deletedAt: null,
    ghost: false,
    ...search,
  };

  const select = CHAT_USER_SELECT;
  const orderBy = [{ prenom: "asc" as const }, { nom: "asc" as const }];
  const take = 300;

  let users: SelectedUser[] = [];

  if (actor.role === "admin") {
    users = await prisma.utilisateur.findMany({
      where: { ...base, role: { in: ["prof", "eleve"] } },
      select,
      orderBy,
      take,
    });
  } else if (actor.role === "eleve") {
    const [profs, admins] = await Promise.all([
      prisma.utilisateur.findMany({
        where: {
          ...base,
          role: "prof",
          groupesEnseigne: {
            some: {
              centerId: actor.centerId,
              inscriptions: { some: { eleveId: actor.id, statut: "actif" } },
            },
          },
        },
        select,
        orderBy,
        take,
      }),
      prisma.utilisateur.findMany({
        where: { ...base, role: "admin" },
        select,
        orderBy,
        take,
      }),
    ]);
    users = [...profs, ...admins];
  } else if (actor.role === "prof") {
    const [admins, eleves] = await Promise.all([
      prisma.utilisateur.findMany({
        where: { ...base, role: "admin" },
        select,
        orderBy,
        take,
      }),
      prisma.utilisateur.findMany({
        where: {
          ...base,
          role: "eleve",
          inscriptions: {
            some: {
              statut: "actif",
              groupe: { centerId: actor.centerId, profId: actor.id },
            },
          },
        },
        select,
        orderBy,
        take,
      }),
    ]);
    users = [...admins, ...eleves];
  }

  const seen = new Set<string>();
  const result: ContactResult[] = [];
  for (const user of users) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    result.push({ ...serializeChatUser(user), email: user.email });
  }
  return result;
}

export interface ConversationAccess {
  participant: {
    id: string;
    unreadCount: number;
    lastReadAt: Date | null;
  };
  other: {
    userId: string;
    lastReadAt: Date | null;
    user: SelectedUser;
  };
  conversation: {
    id: string;
    lastMessageAt: Date;
  };
}

export async function getConversationForActor(
  actor: ChatActor,
  conversationId: string
): Promise<ConversationAccess | null> {
  if (!conversationId) return null;

  // Deux requêtes plates plutôt qu'une lecture imbriquée : sur une base
  // distante, chaque niveau d'imbrication coûte un aller-retour supplémentaire.
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: actor.id,
      conversation: { centerId: actor.centerId },
    },
    select: {
      id: true,
      unreadCount: true,
      lastReadAt: true,
      conversation: { select: { id: true, lastMessageAt: true } },
    },
  });

  if (!participant) return null;

  const other = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: { not: actor.id } },
    select: {
      userId: true,
      lastReadAt: true,
      user: { select: CHAT_USER_SELECT },
    },
  });

  if (!other) return null;

  return {
    participant: {
      id: participant.id,
      unreadCount: participant.unreadCount,
      lastReadAt: participant.lastReadAt,
    },
    other,
    conversation: {
      id: participant.conversation.id,
      lastMessageAt: participant.conversation.lastMessageAt,
    },
  };
}

export async function markConversationRead(
  actor: ChatActor,
  conversationId: string
): Promise<Date | null> {
  const access = await getConversationForActor(actor, conversationId);
  if (!access) return null;

  const now = new Date();
  await prisma.$transaction([
    prisma.conversationParticipant.update({
      where: { id: access.participant.id },
      data: { unreadCount: 0, lastReadAt: now },
    }),
    prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: actor.id },
        readAt: null,
      },
      data: { readAt: now },
    }),
    // La cloche ne doit plus signaler une conversation déjà ouverte.
    prisma.notification.updateMany({
      where: {
        destinataireId: actor.id,
        type: "chat_message",
        lu: false,
        lien: `/messages?c=${conversationId}`,
      },
      data: { lu: true },
    }),
  ]);

  return now;
}
