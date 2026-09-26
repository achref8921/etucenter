import { prisma } from "@/lib/prisma";

/**
 * Returns the subset of ids that currently have a stored image,
 * without transferring any image bytes.
 */
export async function getImageIdSet(ids: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Set();
  const withImage = await prisma.utilisateur.findMany({
    where: { id: { in: unique }, image: { not: null } },
    select: { id: true },
  });
  return new Set(withImage.map((u) => u.id));
}

/**
 * Attaches a `hasImage` boolean to a flat list.
 * One extra lightweight query per list instead of shipping base64 payloads.
 */
export async function attachHasImage<T extends { id: string }>(
  rows: T[]
): Promise<Array<T & { hasImage: boolean }>> {
  if (!rows.length) return [];
  const set = await getImageIdSet(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, hasImage: set.has(r.id) }));
}
