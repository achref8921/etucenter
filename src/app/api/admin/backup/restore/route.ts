import { NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;
    const centerId = (session.user as any).centerId;

    const body = await request.json();
    const { backup, mode } = body;

    if (!backup || !backup.data) {
      return NextResponse.json({ error: "Fichier de backup invalide" }, { status: 400 });
    }

    const idMap: Record<string, string> = {};
    const logs: string[] = [];
    let created = 0;
    let skipped = 0;

    const result = await prisma.$transaction(async (tx) => {
      if (mode === "merge" || mode === "full") {
        if (mode === "full") {
          await tx.presence.deleteMany({ where: { seance: { groupe: { centerId } } } });
          await tx.paiement.deleteMany({ where: { groupe: { centerId } } });
          await tx.seance.deleteMany({ where: { groupe: { centerId } } });
          await tx.inscription.deleteMany({ where: { groupe: { centerId } } });
          await tx.tauxBenefice.deleteMany({ where: { prof: { centerId } } });
          await tx.notification.deleteMany({ where: { centerId } });
          await tx.groupe.deleteMany({ where: { centerId } });
          await tx.matiere.deleteMany({ where: { centerId } });
          logs.push("Anciennes données supprimées (mode complet)");
        }

        if (backup.data.matieres?.length) {
          for (const m of backup.data.matieres) {
            const existing = await tx.matiere.findFirst({ where: { centerId, nom: m.nom } });
            if (existing) {
              idMap[m.id] = existing.id;
              skipped++;
            } else {
              const created_ = await tx.matiere.create({
                data: {
                  centerId, nom: m.nom, description: m.description || null,
                },
              });
              idMap[m.id] = created_.id;
              created++;
            }
          }
          logs.push(`Matieres: ${created} créées, ${skipped} ignorées`);
        }

        let userCreated = 0;
        let userSkipped = 0;
        if (backup.data.utilisateurs?.length) {
          for (const u of backup.data.utilisateurs) {
            const existing = await tx.utilisateur.findUnique({ where: { email: u.email } });
            if (existing) {
              idMap[u.id] = existing.id;
              userSkipped++;
            } else {
              const created_ = await tx.utilisateur.create({
                data: {
                  centerId, nom: u.nom, prenom: u.prenom, email: u.email,
                  telephone: u.telephone || null, role: u.role, actif: u.actif ?? false,
                  motDePasse: u.motDePasse || null, codeEleve: u.codeEleve || null,
                  niveau: u.niveau || null, classe: u.classe || null,
                  filiere: u.filiere || null,
                  dateNaissance: u.dateNaissance ? new Date(u.dateNaissance) : null,
                },
              });
              idMap[u.id] = created_.id;
              userCreated++;
            }
          }
          logs.push(`Utilisateurs: ${userCreated} créés, ${userSkipped} ignorés`);
        }

        if (backup.data.groupes?.length) {
          for (const g of backup.data.groupes) {
            const newProfId = g.profId ? idMap[g.profId] || null : null;
            const newMatiereId = g.matiereId ? idMap[g.matiereId] || null : null;
            const existing = await tx.groupe.findFirst({
              where: { centerId, nom: g.nom },
            });
            if (existing) {
              idMap[g.id] = existing.id;
            } else {
              const created_ = await tx.groupe.create({
                data: {
                  centerId, nom: g.nom, description: g.description || null,
                  profId: newProfId, matiereId: newMatiereId,
                  prixParSeance: g.prixParSeance || 0,
                  capaciteMax: g.capaciteMax || null,
                },
              });
              idMap[g.id] = created_.id;
              created++;
            }
          }
          logs.push(`Groupes: créés/mappés`);
        }

        if (backup.data.seances?.length) {
          for (const s of backup.data.seances) {
            const newGroupeId = idMap[s.groupeId];
            if (!newGroupeId) { skipped++; continue; }
            const existing = await tx.seance.findFirst({
              where: { groupeId: newGroupeId, date: new Date(s.date) },
            });
            if (existing) {
              idMap[s.id] = existing.id;
            } else {
              const created_ = await tx.seance.create({
                data: {
                  groupeId: newGroupeId, date: new Date(s.date),
                  heureDebut: s.heureDebut ? new Date(s.heureDebut) : null,
                  heureFin: s.heureFin ? new Date(s.heureFin) : null,
                  statut: s.statut || "planifiee", notes: s.notes || null,
                },
              });
              idMap[s.id] = created_.id;
              created++;
            }
          }
          logs.push(`Seances: créées/mappées`);
        }

        if (backup.data.inscriptions?.length) {
          for (const ins of backup.data.inscriptions) {
            const newEleveId = idMap[ins.eleveId];
            const newGroupeId = idMap[ins.groupeId];
            if (!newEleveId || !newGroupeId) { skipped++; continue; }
            const existing = await tx.inscription.findUnique({
              where: { eleveId_groupeId: { eleveId: newEleveId, groupeId: newGroupeId } },
            });
            if (!existing) {
              await tx.inscription.create({
                data: {
                  eleveId: newEleveId, groupeId: newGroupeId,
                  dateInscription: ins.dateInscription ? new Date(ins.dateInscription) : new Date(),
                  statut: ins.statut || "actif",
                },
              });
              created++;
            }
          }
          logs.push(`Inscriptions: créées`);
        }

        if (backup.data.presences?.length) {
          for (const p of backup.data.presences) {
            const newSeanceId = idMap[p.seanceId];
            const newEleveId = idMap[p.eleveId];
            if (!newSeanceId || !newEleveId) { skipped++; continue; }
            const existing = await tx.presence.findUnique({
              where: { seanceId_eleveId: { seanceId: newSeanceId, eleveId: newEleveId } },
            });
            if (!existing) {
              await tx.presence.create({
                data: {
                  seanceId: newSeanceId, eleveId: newEleveId, statut: p.statut,
                  enregistrePar: p.enregistrePar ? (idMap[p.enregistrePar] || null) : null,
                },
              });
              created++;
            }
          }
          logs.push(`Presences: créées`);
        }

        if (backup.data.paiements?.length) {
          for (const pay of backup.data.paiements) {
            const newEleveId = idMap[pay.eleveId];
            const newGroupeId = idMap[pay.groupeId];
            if (!newEleveId || !newGroupeId) { skipped++; continue; }
            const existing = await tx.paiement.findFirst({
              where: {
                eleveId: newEleveId, groupeId: newGroupeId,
                montant: pay.montant, datePaiement: new Date(pay.datePaiement),
              },
            });
            if (!existing) {
              await tx.paiement.create({
                data: {
                  eleveId: newEleveId, groupeId: newGroupeId,
                  montant: pay.montant, datePaiement: new Date(pay.datePaiement),
                  methodePaiement: pay.methodePaiement || "especes",
                  reference: pay.reference || null, notes: pay.notes || null,
                },
              });
              created++;
            }
          }
          logs.push(`Paiements: créés`);
        }

        if (backup.data.tauxBenefices?.length) {
          for (const tb of backup.data.tauxBenefices) {
            const newProfId = idMap[tb.profId];
            if (!newProfId) { skipped++; continue; }
            const existing = await tx.tauxBenefice.findUnique({ where: { profId: newProfId } });
            if (!existing) {
              await tx.tauxBenefice.create({
                data: { profId: newProfId, tauxPourcentage: tb.tauxPourcentage },
              });
              created++;
            }
          }
          logs.push(`Taux benefices: créés`);
        }
      }

      return { created, skipped, logs };
    });

    return NextResponse.json({
      success: true,
      message: `Import terminé: ${result.created} éléments importés, ${result.skipped} ignorés`,
      logs: result.logs,
      mode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erreur lors de l'import: " + (error.message || "Erreur inconnue") },
      { status: 500 }
    );
  }
}
