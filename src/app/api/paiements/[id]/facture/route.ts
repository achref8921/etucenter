import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const paiement = await prisma.paiement.findUnique({
      where: { id },
      include: {
        eleve: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
            dateNaissance: true,
            niveau: true,
            classe: true,
            filiere: true,
            codeEleve: true,
          },
        },
        groupe: {
          select: {
            id: true,
            nom: true,
            prixParSeance: true,
            capaciteMax: true,
            prof: { select: { nom: true, prenom: true } },
            matiere: { select: { nom: true } },
          },
        },
      },
    });

    if (!paiement) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const userCenterId = (session.user as any).centerId;

    if (userRole === "eleve" && paiement.eleveId !== (session.user as any).id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    if (userRole === "admin" || userRole === "prof") {
      const groupe = await prisma.groupe.findUnique({
        where: { id: paiement.groupeId },
        select: { centerId: true },
      });
      if (!groupe || groupe.centerId !== userCenterId) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      }
    }

    const centre = await prisma.center.findUnique({
      where: { id: userCenterId || paiement.eleveId },
      select: { name: true, phone: true, address: true, logo: true },
    });

    let centreData = centre;
    if (!centreData && userCenterId) {
      const groupe = await prisma.groupe.findUnique({
        where: { id: paiement.groupeId },
        select: { centerId: true },
      });
      if (groupe) {
        centreData = await prisma.center.findUnique({
          where: { id: groupe.centerId },
          select: { name: true, phone: true, address: true, logo: true },
        });
      }
    }

    const centreName = centreData?.name || "Centre";
    const centrePhone = centreData?.phone || "";
    const centreAddress = centreData?.address || "";
    const centreLogo = centreData?.logo || "";

    const paiementDate = new Date(paiement.datePaiement);
    const paymentMonth = paiementDate.getMonth();
    const paymentYear = paiementDate.getFullYear();
    const monthStart = new Date(paymentYear, paymentMonth, 1);
    const monthEnd = new Date(paymentYear, paymentMonth + 1, 0, 23, 59, 59);

    const monthName = paiementDate.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });

    const [totalSeances, presences, allPresences, totalPayments, allInscriptions] =
      await Promise.all([
        prisma.seance.count({
          where: {
            groupeId: paiement.groupeId,
            date: { gte: monthStart, lte: monthEnd },
          },
        }),
        prisma.presence.findMany({
          where: {
            eleveId: paiement.eleveId,
            seance: {
              groupeId: paiement.groupeId,
              date: { gte: monthStart, lte: monthEnd },
            },
          },
          select: { statut: true, seance: { select: { date: true, heureDebut: true } } },
          orderBy: { seance: { date: "asc" } },
        }),
        prisma.presence.findMany({
          where: {
            eleveId: paiement.eleveId,
            seance: {
              groupeId: paiement.groupeId,
            },
          },
          select: { statut: true, seance: { select: { date: true } } },
        }),
        prisma.paiement.aggregate({
          _sum: { montant: true },
          where: {
            eleveId: paiement.eleveId,
            groupeId: paiement.groupeId,
          },
        }),
        prisma.inscription.findMany({
          where: { eleveId: paiement.eleveId },
          include: {
            groupe: {
              select: { nom: true, matiere: { select: { nom: true } } },
            },
          },
        }),
      ]);

    const presentCount = presences.filter((p) => p.statut === "present").length;
    const absentCount = presences.filter((p) => p.statut === "absent").length;
    const retardCount = 0;
    const excusedCount = 0;
    const noRecordCount = totalSeances - presentCount - absentCount;

    const totalAllPresent = allPresences.filter((p) => p.statut === "present").length;
    const totalAllAbsent = allPresences.filter((p) => p.statut === "absent").length;
    const totalAllSeances = allPresences.length;

    const totalPaid = Number(totalPayments._sum.montant || 0);
    const prixParSeance = Number(paiement.groupe.prixParSeance || 0);
    const monthlyDue = prixParSeance;
    const remaining = monthlyDue - totalPaid;

    const montant = Number(paiement.montant);
    const dateStr = paiementDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const methodeLabel: Record<string, string> = {
      especes: "Espèces",
      virement: "Virement bancaire",
      cheque: "Chèque",
      autre: "Autre",
    };

    const presenceTaux = totalSeances > 0 ? Math.round((presentCount / totalSeances) * 100) : 0;
    const absenceTaux = totalSeances > 0 ? Math.round((absentCount / totalSeances) * 100) : 0;

    const presenceRows = presences
      .map(
        (p) => `
        <tr>
          <td>${p.seance.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
          <td>${p.seance.heureDebut ? p.seance.heureDebut.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
          <td><span class="badge-${p.statut}">${p.statut === "present" ? "Présent" : p.statut === "absent" ? "Absent" : p.statut === "retard" ? "Retard" : "Excusé"}</span></td>
        </tr>`
      )
      .join("");

    const inscriptionRows = allInscriptions
      .map(
        (ins) => `
        <tr>
          <td>${ins.groupe.nom}</td>
          <td>${ins.groupe.matiere?.nom || "—"}</td>
          <td>${new Date(ins.dateInscription).toLocaleDateString("fr-FR")}</td>
          <td><span class="badge-${ins.statut === "actif" ? "present" : "absent"}">${ins.statut === "actif" ? "Actif" : "Inactif"}</span></td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture ${paiement.id.slice(0, 8).toUpperCase()}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 30px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 3px solid #2563eb; padding-bottom: 15px; }
  .header-left { display: flex; gap: 15px; align-items: center; }
  .header-left img { height: 50px; width: 50px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; }
  .header-left h1 { font-size: 20px; color: #2563eb; }
  .header-left p { font-size: 12px; color: #64748b; }
  .header-right { text-align: right; }
  .header-right h2 { font-size: 26px; color: #1e293b; letter-spacing: 2px; }
  .header-right p { font-size: 12px; color: #64748b; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
  .info-box { background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; }
  .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
  .info-box p { font-size: 12px; color: #334155; line-height: 1.6; }
  .info-box strong { color: #1e293b; }
  .section-title { font-size: 14px; font-weight: 700; color: #2563eb; margin: 20px 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
  thead th { background: #2563eb; color: #fff; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  .badge-present { background: #dcfce7; color: #16a34a; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; }
  .badge-absent { background: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; }
  .badge-retard { background: #fef9c3; color: #ca8a04; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; }
  .badge-excuse { background: #e0e7ff; color: #4f46e5; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .stat-card { background: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #e2e8f0; }
  .stat-card .number { font-size: 22px; font-weight: 700; color: #1e293b; }
  .stat-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-top: 2px; }
  .stat-card.green { border-color: #bbf7d0; background: #f0fdf4; }
  .stat-card.green .number { color: #16a34a; }
  .stat-card.red { border-color: #fecaca; background: #fef2f2; }
  .stat-card.red .number { color: #dc2626; }
  .stat-card.yellow { border-color: #fef08a; background: #fefce8; }
  .stat-card.yellow .number { color: #ca8a04; }
  .stat-card.blue { border-color: #bfdbfe; background: #eff6ff; }
  .stat-card.blue .number { color: #2563eb; }
  .total-box { background: #2563eb; color: #fff; border-radius: 8px; padding: 14px 24px; text-align: right; margin-bottom: 20px; float: right; }
  .total-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
  .total-box .amount { font-size: 24px; font-weight: 700; margin-top: 2px; }
  .progress-bar { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 5px; }
  .progress-fill { height: 100%; border-radius: 4px; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; margin-top: 20px; }
  .footer p { font-size: 11px; color: #94a3b8; line-height: 1.6; }
  .clearfix::after { content: ""; display: table; clear: both; }
  @media print { body { padding: 0; font-size: 11px; } .no-print { display: none !important; } }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center; margin-bottom:15px;">
    <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
      Imprimer / Sauvegarder en PDF
    </button>
  </div>

  <div class="header">
    <div class="header-left">
      ${centreLogo ? `<img src="${centreLogo}" alt="${centreName}">` : ""}
      <div>
        <h1>${centreName}</h1>
        <p>${centreAddress}</p>
        <p>${centrePhone}</p>
      </div>
    </div>
    <div class="header-right">
      <h2>FACTURE</h2>
      <p>N° ${paiement.id.slice(0, 8).toUpperCase()}</p>
      <p>${dateStr}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Informations de l'élève</h3>
      <p>
        <strong>${paiement.eleve.prenom} ${paiement.eleve.nom}</strong><br>
        ${paiement.eleve.email}<br>
        ${paiement.eleve.telephone ? `Tél : ${paiement.eleve.telephone}<br>` : ""}
        ${paiement.eleve.codeEleve ? `Code : ${paiement.eleve.codeEleve}<br>` : ""}
        ${paiement.eleve.niveau ? `Niveau : ${paiement.eleve.niveau}${paiement.eleve.classe ? " — " + paiement.eleve.classe : ""}${paiement.eleve.filiere ? " — " + paiement.eleve.filiere : ""}<br>` : ""}
        ${paiement.eleve.dateNaissance ? `Né(e) le : ${new Date(paiement.eleve.dateNaissance).toLocaleDateString("fr-FR")}` : ""}
      </p>
    </div>
    <div class="info-box">
      <h3>Détails du paiement</h3>
      <p>
        <strong>Date :</strong> ${dateStr}<br>
        <strong>Méthode :</strong> ${methodeLabel[paiement.methodePaiement] || paiement.methodePaiement}<br>
        ${paiement.reference ? `<strong>Référence :</strong> ${paiement.reference}<br>` : ""}
        ${paiement.notes ? `<strong>Notes :</strong> ${paiement.notes}` : ""}
      </p>
    </div>
    <div class="info-box">
      <h3>Groupe & Matière</h3>
      <p>
        <strong>Groupe :</strong> ${paiement.groupe.nom}<br>
        <strong>Matière :</strong> ${paiement.groupe.matiere?.nom || "—"}<br>
        <strong>Prof :</strong> ${paiement.groupe.prof ? `${paiement.groupe.prof.prenom} ${paiement.groupe.prof.nom}` : "—"}<br>
        ${paiement.groupe.capaciteMax ? `<strong>Capacité max :</strong> ${paiement.groupe.capaciteMax} élèves` : ""}
      </p>
    </div>
    <div class="info-box">
      <h3>Période</h3>
      <p>
        <strong>Mois :</strong> ${monthName}<br>
        <strong>Prix/mois :</strong> ${prixParSeance.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT<br>
        <strong>Total dû :</strong> ${monthlyDue.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT
      </p>
    </div>
  </div>

  <div class="section-title">Statistiques de présence — ${monthName}</div>
  <div class="stats-grid">
    <div class="stat-card blue">
      <div class="number">${totalSeances}</div>
      <div class="label">Séances totales</div>
    </div>
    <div class="stat-card green">
      <div class="number">${presentCount}</div>
      <div class="label">Présences</div>
    </div>
    <div class="stat-card red">
      <div class="number">${absentCount}</div>
      <div class="label">Absences</div>
    </div>
    <div class="stat-card yellow">
      <div class="number">${retardCount}</div>
      <div class="label">Retards</div>
    </div>
  </div>
  <div style="margin-bottom: 20px;">
    <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:3px;">
      <span>Taux de présence: <strong style="color:#16a34a">${presenceTaux}%</strong></span>
      <span>Taux d'absence: <strong style="color:#dc2626">${absenceTaux}%</strong></span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${presenceTaux}%; background: linear-gradient(90deg, #22c55e ${presenceTaux}%, #ef4444 100%);"></div>
    </div>
    ${excusedCount > 0 ? `<p style="font-size:11px; color:#64748b; margin-top:5px;">Excusés : ${excusedCount} | Pas encore enregistré : ${noRecordCount > 0 ? noRecordCount : 0}</p>` : ""}
  </div>

  <div class="section-title">Détail des présences</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Heure</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>
      ${presenceRows || `<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Aucune présence enregistrée ce mois</td></tr>`}
    </tbody>
  </table>

  ${allInscriptions.length > 0 ? `
  <div class="section-title">Inscriptions de l'élève</div>
  <table>
    <thead>
      <tr>
        <th>Groupe</th>
        <th>Matière</th>
        <th>Date d'inscription</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>
      ${inscriptionRows}
    </tbody>
  </table>
  ` : ""}

  <div class="section-title">Récapitulatif financier</div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Montant</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Frais mensuel du groupe</td>
        <td style="text-align:right;font-weight:600;">${monthlyDue.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</td>
      </tr>
      <tr>
        <td>Total payé (cumul)</td>
        <td style="text-align:right;font-weight:600;color:#16a34a;">${totalPaid.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</td>
      </tr>
      ${remaining > 0 ? `
      <tr>
        <td style="color:#dc2626;font-weight:600;">Reste à payer</td>
        <td style="text-align:right;font-weight:600;color:#dc2626;">${remaining.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</td>
      </tr>
      ` : `
      <tr>
        <td style="color:#16a34a;font-weight:600;">Soldé</td>
        <td style="text-align:right;font-weight:600;color:#16a34a;">0,00 DT</td>
      </tr>
      `}
    </tbody>
  </table>

  <div class="clearfix">
    <div class="total-box">
      <div class="label">Ce paiement</div>
      <div class="amount">${montant.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</div>
    </div>
  </div>
  <div style="clear:both"></div>

  <div class="footer">
    <p><strong>${centreName}</strong>${centrePhone ? " — Tél : " + centrePhone : ""}${centreAddress ? " — " + centreAddress : ""}</p>
    <p style="margin-top:4px;">Facture générée le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
