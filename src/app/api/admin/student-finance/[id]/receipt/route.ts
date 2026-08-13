import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES, ELEVE_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getStudentBalance, studentTypeLabel } from "@/lib/student-finance";
import { round2 } from "@/lib/teacher-finance";

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const METHODE_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement bancaire",
  cheque: "Chèque",
  autre: "Autre",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", [...ADMIN_ROLES, ...ELEVE_ROLES]);
    if (error) return error;

    const { id } = await params;
    const user = session.user as any;

    const transaction = await prisma.studentTransaction.findUnique({
      where: { id },
      include: {
        eleve: {
          select: { id: true, nom: true, prenom: true, email: true, telephone: true, codeEleve: true },
        },
        reversalOf: { select: { id: true, type: true, receiptNumber: true } },
      },
    });

    if (!transaction || transaction.centerId !== user.centerId) {
      return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });
    }

    if (user.role === "eleve" && transaction.eleveId !== user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const [center, creator] = await Promise.all([
      prisma.center.findUnique({
        where: { id: transaction.centerId },
        select: { name: true, phone: true, address: true, logo: true },
      }),
      transaction.createdBy
        ? prisma.utilisateur.findUnique({
            where: { id: transaction.createdBy },
            select: { prenom: true, nom: true },
          })
        : null,
    ]);

    const centreName = center?.name || "Centre";
    const centrePhone = center?.phone || "";
    const centreAddress = center?.address || "";
    const centreLogo = center?.logo || "";

    const dateStr = new Date(transaction.date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const timeStr = transaction.time
      ? new Date(transaction.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "";

    const balanceAfter = await getStudentBalance(transaction.centerId, transaction.eleveId);
    const balanceBefore = round2(balanceAfter - Number(transaction.signedAmount));
    const absAmount = Math.abs(Number(transaction.amount));
    const signed = Number(transaction.signedAmount);
    const methodLabel = transaction.paymentMethod
      ? METHODE_LABEL[transaction.paymentMethod] || transaction.paymentMethod
      : "—";

    const isReversal = transaction.type === "REVERSAL";
    const title = isReversal ? "REÇU D'ANNULATION" : "REÇU DE PAIEMENT";
    const badgeColor = isReversal ? "#dc2626" : "#16a34a";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title} ${esc(transaction.receiptNumber || transaction.id.slice(0, 8).toUpperCase())}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 30px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 3px solid ${badgeColor}; padding-bottom: 15px; }
  .header-left { display: flex; gap: 15px; align-items: center; }
  .header-left img { height: 50px; width: 50px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; }
  .header-left h1 { font-size: 20px; color: #1e293b; }
  .header-left p { font-size: 12px; color: #64748b; }
  .header-right { text-align: right; }
  .header-right h2 { font-size: 24px; color: ${badgeColor}; letter-spacing: 2px; }
  .header-right p { font-size: 12px; color: #64748b; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
  .info-box { background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; }
  .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
  .info-box p { font-size: 12px; color: #334155; line-height: 1.6; }
  .info-box strong { color: #1e293b; }
  .amount-box { background: ${badgeColor}; color: #fff; border-radius: 8px; padding: 18px 24px; text-align: center; margin: 20px 0; }
  .amount-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }
  .amount-box .value { font-size: 30px; font-weight: 700; margin-top: 4px; }
  .balance-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .balance-table td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  .balance-table td:last-child { text-align: right; font-weight: 600; }
  .desc-box { background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
  .desc-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; }
  .desc-box p { font-size: 13px; color: #334155; line-height: 1.5; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; margin-top: 20px; }
  .footer p { font-size: 11px; color: #94a3b8; line-height: 1.6; }
  @media print { body { padding: 0; font-size: 11px; } .no-print { display: none !important; } }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center; margin-bottom:15px;">
    <button onclick="window.print()" style="background:${badgeColor};color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
      Imprimer / Sauvegarder en PDF
    </button>
  </div>

  <div class="header">
    <div class="header-left">
      ${centreLogo ? `<img src="${esc(centreLogo)}" alt="${esc(centreName)}">` : ""}
      <div>
        <h1>${esc(centreName)}</h1>
        <p>${esc(centreAddress)}</p>
        <p>${esc(centrePhone)}</p>
      </div>
    </div>
    <div class="header-right">
      <h2>${title}</h2>
      <p>N° ${esc(transaction.receiptNumber || transaction.id.slice(0, 8).toUpperCase())}</p>
      <p>${dateStr}${timeStr ? " à " + esc(timeStr) : ""}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Élève</h3>
      <p>
        <strong>${esc(transaction.eleve.prenom)} ${esc(transaction.eleve.nom)}</strong><br>
        ${transaction.eleve.codeEleve ? `Code : #${esc(transaction.eleve.codeEleve)}<br>` : ""}
        ${esc(transaction.eleve.email)}<br>
        ${transaction.eleve.telephone ? `Tél : ${esc(transaction.eleve.telephone)}` : ""}
      </p>
    </div>
    <div class="info-box">
      <h3>Détails</h3>
      <p>
        <strong>Type :</strong> ${esc(studentTypeLabel(transaction.type))}<br>
        <strong>Méthode :</strong> ${esc(methodLabel)}<br>
        ${transaction.reference ? `<strong>Référence :</strong> ${esc(transaction.reference)}<br>` : ""}
        ${transaction.reversalOf?.receiptNumber ? `<strong>Annule le reçu :</strong> ${esc(transaction.reversalOf.receiptNumber)}<br>` : ""}
        ${transaction.reversedAt ? `<strong>Annulé le :</strong> ${new Date(transaction.reversedAt).toLocaleDateString("fr-FR")}` : ""}
      </p>
    </div>
  </div>

  <div class="desc-box">
    <h3>Description</h3>
    <p>${esc(transaction.description)}</p>
    ${transaction.notes ? `<p style="margin-top:6px;color:#64748b;font-size:12px;">${esc(transaction.notes)}</p>` : ""}
  </div>

  <div class="amount-box">
    <div class="label">${signed >= 0 ? "Montant crédité" : "Montant débité"}</div>
    <div class="value">${absAmount.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</div>
  </div>

  <table class="balance-table">
    <tr><td>Solde avant</td><td>${balanceBefore.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</td></tr>
    <tr><td>Montant ${signed >= 0 ? "ajouté" : "débité"}</td><td>${signed >= 0 ? "+" : ""}${signed.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</td></tr>
    <tr><td>Solde après</td><td>${balanceAfter.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</td></tr>
    <tr><td>Enregistré par</td><td>${creator ? esc(creator.prenom + " " + creator.nom) : "—"}</td></tr>
  </table>

  <div class="footer">
    <p><strong>${esc(centreName)}</strong>${centrePhone ? " — Tél : " + esc(centrePhone) : ""}${centreAddress ? " — " + esc(centreAddress) : ""}</p>
    <p style="margin-top:4px;">Reçu généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    logger.error("Erreur lors de la génération du reçu élève", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
