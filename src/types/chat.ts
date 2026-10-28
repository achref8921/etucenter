export type ChatRole = "admin" | "prof" | "eleve";

export interface ChatUser {
  id: string;
  nom: string;
  prenom: string;
  role: ChatRole;
  email?: string;
  image: string | null;
  lastSeenAt: string | null;
  online: boolean;
}

export interface ChatLastMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  readAt: string | null;
}

export interface ChatDirectoryGroupInfo {
  id: string;
  nom: string;
  matiere: string | null;
}

export interface ChatDirectoryUser extends ChatUser {
  email?: string;
  /** Groupes dans lesquels l'utilisateur est concerné (élève inscrit, prof responsable). */
  groups: ChatDirectoryGroupInfo[];
  groupCount?: number;
}

export interface ChatDirectoryGroup {
  id: string;
  nom: string;
  matiere: string | null;
  profId: string | null;
  profName: string | null;
  count: number;
}

export interface ChatDirectory {
  role: ChatRole;
  /** Professeurs (admin), administration (prof), professeurs + administration (élève). */
  contacts: ChatDirectoryUser[];
  contactsLabel: string;
  /** Groupes actifs visibles par l'acteur, avec leur effectif. */
  groups: ChatDirectoryGroup[];
  /** Élèves de la page courante (admin / prof). */
  eleves: ChatDirectoryUser[];
  /** Effectif global (tous groupes confondus). */
  totalStudents: number;
  /** Nombre total de contacts (professeurs ou administration), hors recherche. */
  totalContacts: number;
  /** Effectif correspondant au filtre courant (recherche / groupe). */
  totalEleves: number;
  ungroupedCount: number;
  hasMore: boolean;
}

export interface ChatConversationSummary {
  id: string;
  other: ChatUser;
  lastMessage: ChatLastMessage | null;
  unreadCount: number;
  lastMessageAt: string;
  lastReadAt: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  clientId: string | null;
  createdAt: string;
  readAt: string | null;
  pending?: boolean;
  failed?: boolean;
}

export interface ChatThread {
  conversation: {
    id: string;
    lastMessageAt: string;
    other: ChatUser;
    myLastReadAt: string | null;
    otherLastReadAt: string | null;
  };
  messages: ChatMessage[];
  hasMore: boolean;
}
