const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const profs = await prisma.utilisateur.findMany({
    where: { role: "prof", deletedAt: null },
    select: { id: true, prenom: true, nom: true, centerId: true },
    take: 10,
  });

  for (const prof of profs) {
    const groupes = await prisma.groupe.findMany({
      where: { profId: prof.id },
      select: { id: true, nom: true, prixParSeance: true },
    });
    if (groupes.length === 0) continue;
    const groupeIds = groupes.map((g) => g.id);

    const inscriptions = await prisma.inscription.findMany({
      where: { groupeId: { in: groupeIds }, statut: "actif", eleve: { deletedAt: null } },
      select: { eleveId: true, groupeId: true, eleve: { select: { prenom: true, nom: true } } },
    });

    // presence due per student+group
    const presenceData = await prisma.$queryRawUnsafe(
      `SELECT pr.eleve_id, s.groupe_id,
              COUNT(*)::int as total,
              SUM(CASE WHEN pr.statut = 'present' THEN 1 ELSE 0 END)::int as present,
              COALESCE(SUM(CASE WHEN pr.statut = 'present' THEN COALESCE(s.prix_par_seance, g.prix_par_seance) ELSE 0 END), 0)::numeric(12,2) as due
       FROM presences pr
       JOIN seances s ON pr.seance_id = s.id
       JOIN groupes g ON s.groupe_id = g.id
       WHERE pr.eleve_id = ANY($1::uuid[]) AND s.groupe_id = ANY($2::uuid[]) AND s.statut = 'terminee'
       GROUP BY pr.eleve_id, s.groupe_id`,
      [...new Set(inscriptions.map((i) => i.eleveId))],
      groupeIds
    );

    const payments = await prisma.paiement.groupBy({
      by: ["eleveId", "groupeId"],
      where: { eleveId: { in: inscriptions.map((i) => i.eleveId) }, groupeId: { in: groupeIds } },
      _sum: { montant: true },
    });

    const pmap = new Map();
    for (const p of payments) pmap.set(`${p.eleveId}-${p.groupeId}`, Number(p._sum.montant));
    const dmap = new Map();
    for (const d of presenceData) dmap.set(`${d.eleve_id}-${d.groupe_id}`, { due: Number(d.due), present: d.present, total: d.total });

    console.log(`\n### Prof ${prof.prenom} ${prof.nom} — groupes: ${groupes.map((g) => g.nom).join(", ")}`);
    const seen = new Set();
    for (const ins of inscriptions) {
      const key = `${ins.eleveId}-${ins.groupeId}`;
      if (seen.has(ins.eleveId + "|" + ins.groupeId)) continue;
      seen.add(ins.eleveId + "|" + ins.groupeId);
      const due = dmap.get(key)?.due ?? 0;
      const paid = pmap.get(key) ?? 0;
      const impaye = Math.max(0, due - paid);
      const avance = Math.max(0, paid - due);
      console.log(`  ${ins.eleve.prenom} ${ins.eleve.nom} — groupe ${ins.groupeId.slice(0,8)} | présents=${dmap.get(key)?.present ?? 0}/${dmap.get(key)?.total ?? 0} | dû=${due} payé=${paid} impayé=${impaye} avance=${avance}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
