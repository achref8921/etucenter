import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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
    const { session, error } = await requireActiveCenter("GET", [...ADMIN_ROLES, ...PROF_ROLES]);
    if (error) return error;

    const { id } = await params;
    const user = session.user as any;

    const transaction = await prisma.teacherTransaction.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
          },
        },
        reversalOf: { select: { id: true, type: true, receiptNumber: true } },
      },
    });

    if (!transaction || transaction.centerId !== user.centerId) {
      return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });
    }

    if (user.role === "prof" && transaction.teacherId !== user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const center = await prisma.center.findUnique({
      where: { id: transaction.centerId },
      select: { name: true, phone: true, address: true, logo: true },
    });

    const centreName = center?.name || "Centre";
    const centrePhone = center?.phone || "";
    const centreAddress = center?.address || "";
    const centreLogo = center?.logo || "";

    const dateStr = new Date(transaction.date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const amount = Number(transaction.signedAmount);
    const absAmount = Math.abs(Number(transaction.amount));
    const methodLabel = transaction.paymentMethod
      ? METHODE_LABEL[transaction.paymentMethod] || transaction.paymentMethod
      : "—";

    const title =
      transaction.type === "REVERSAL"
        ? "REÇU D'ANNULATION"
        : transaction.type === "PAYMENT"
          ? "REÇU DE PAIEMENT"
          : transaction.type === "EARNING"
            ? "BON DE GAIN"
            : "BON D'AJUSTEMENT";

    const badgeColor =
      transaction.type === "REVERSAL"
        ? "#dc2626"
        : transaction.type === "PAYMENT"
          ? "#16a34a"
          : transaction.type === "EARNING"
            ? "#2563eb"
            : "#d97706";

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
      <p>${dateStr}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Bénéficiaire</h3>
      <p>
        <strong>${esc(transaction.teacher.prenom)} ${esc(transaction.teacher.nom)}</strong><br>
        ${esc(transaction.teacher.email)}<br>
        ${transaction.teacher.telephone ? `Tél : ${esc(transaction.teacher.telephone)}` : ""}
      </p>
    </div>
    <div class="info-box">
      <h3>Détails</h3>
      <p>
        <strong>Type :</strong> ${transaction.type === "REVERSAL" ? "Annulation" : transaction.type === "PAYMENT" ? "Paiement" : transaction.type === "EARNING" ? "Gain" : "Ajustement"}<br>
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
    <div class="label">${amount >= 0 ? "Montant crédité" : "Montant débité"}</div>
    <div class="value">${absAmount.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} DT</div>
  </div>

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
    logger.error("Erreur lors de la génération du reçu", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
