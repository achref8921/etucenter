import { prisma } from "@/lib/prisma";
import { getAdminDashboardMonthData } from "@/lib/admin-dashboard-data";
import { getTeacherDashboardFinance, centerSharePercent } from "@/lib/teacher-finance";
import {
  parseIntent,
  suggestionChips,
  ASSISTANT_HELP_AR,
  ASSISTANT_HELP_FR,
} from "./engine";
import type { Lang } from "./engine";
import {
  money,
  int,
  periodRange,
  monthKey,
  unpaidRows,
  revenueByMatiere,
  attendanceCounts,
  absentList,
  mostAbsentStudents,
  mostAbsentGroups,
  mostAbsentProfs,
  seancesInRange,
  unverifiedSeances,
  rattrapageSeances,
  findBestMatch,
  candidateStudents,
  revenueToday,
  collectionStats,
  paymentMethods,
  churnRisk,
  newStudentsMonth,
  profVerificationToday,
  presenceCountsBySeance,
  studentProfileData,
} from "./queries";

export interface AssistantAnswer {
  intent: string;
  lang: Lang;
  reply: string;
  chips: string[];
  ok: boolean;
}

type Role = "admin" | "prof";

function pick(lang: Lang, ar: string, fr: string): string {
  return lang === "ar" ? ar : fr;
}

export async function answer(
  role: Role,
  userId: string,
  centerId: string,
  rawMessage: string
): Promise<AssistantAnswer> {
  const isProf = role === "prof";
  const parsed = parseIntent(rawMessage, isProf);
  const lang = parsed.lang;
  const now = new Date();
  const scope = { centerId, profId: isProf ? userId : undefined };
  const chips = suggestionChips(isProf);

  const fallback = (msg: string): AssistantAnswer => ({
    intent: parsed.kind,
    lang,
    reply: msg,
    chips,
    ok: true,
  });

  try {
    switch (parsed.kind) {
      // ─────────────────────────── FINANCES (admin) ─────────────────────────
      case "profit_month": {
        const mk = monthKey(now);
        const d = await getAdminDashboardMonthData(centerId, mk);
        return fallback(
          pick(
            lang,
            `💼 ${mk} — ربح المركز (حصة المركز): ${money(d.netCenterEarnings)}\n` +
              `إيراد الحصص المسدَّدة (الصافي): ${money(d.netPaidSessionsRevenue)}\n` +
              `حصة الأساتذة (أجور): ${money(Math.max(0, d.netPaidSessionsRevenue - d.netCenterEarnings))}`,
            `💼 ${mk} — Bénéfice du centre : ${money(d.netCenterEarnings)}\n` +
              `Revenu net des séances payées : ${money(d.netPaidSessionsRevenue)}\n` +
              `Part des profs (salaires) : ${money(Math.max(0, d.netPaidSessionsRevenue - d.netCenterEarnings))}`
          )
        );
      }

      case "profit_compare": {
        const curK = monthKey(now);
        const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevK = monthKey(prevD);
        const [cur, prev] = await Promise.all([
          getAdminDashboardMonthData(centerId, curK),
          getAdminDashboardMonthData(centerId, prevK),
        ]);
        const diff = cur.netCenterEarnings - prev.netCenterEarnings;
        const pct = prev.netCenterEarnings > 0 ? Math.round((diff / prev.netCenterEarnings) * 100) : 0;
        return fallback(
          pick(
            lang,
            `📊 ربح المركز ${curK}: ${money(cur.netCenterEarnings)}\n` +
              `الربح في ${prevK}: ${money(prev.netCenterEarnings)}\n` +
              `الفرق: ${diff >= 0 ? "+" : ""}${money(diff)} (${diff >= 0 ? "+" : ""}${pct}%)`,
            `📊 Bénéfice ${curK} : ${money(cur.netCenterEarnings)}\n` +
              `${prevK} : ${money(prev.netCenterEarnings)}\n` +
              `Écart : ${diff >= 0 ? "+" : ""}${money(diff)} (${diff >= 0 ? "+" : ""}${pct}%)`
          )
        );
      }

      case "profit_ytd": {
        const currentMonth = now.getMonth() + 1;
        let total = 0;
        let brut = 0;
        for (let m = 1; m <= currentMonth; m++) {
          const mk = `${now.getFullYear()}-${String(m).padStart(2, "0")}`;
          const d = await getAdminDashboardMonthData(centerId, mk);
          total += d.netCenterEarnings;
          brut += d.netPaidSessionsRevenue;
        }
        return fallback(
          pick(
            lang,
            `📅 منذ بداية ${now.getFullYear()}: ربح المركز ${money(total)}\n` +
              `من إيراد حصص إجمالي ${money(brut)}\n` +
              `(متوسط شهري ${money(Math.round(((total / currentMonth) + Number.EPSILON) * 100) / 100)})`,
            `📅 Depuis le début ${now.getFullYear()} : bénéfice ${money(total)}\n` +
              `sur ${money(brut)} de revenu brut\n` +
              `(moyenne/mois ${money(Math.round((total / currentMonth) * 100) / 100)})`
          )
        );
      }

      case "revenue_by_matiere": {
        const rows = await revenueByMatiere(centerId, parsed.period, now);
        if (rows.length === 0) {
          return fallback(pick(lang, "لا توجد إيرادات لهذه الفترة بعد.", "Aucun revenu sur cette période."));
        }
        const lines = rows
          .slice(0, 6)
          .map((r) => `• ${r.nom}: ${money(r.revenue)}`)
          .join("\n");
        const top = rows[0];
        return fallback(
          pick(
            lang,
            `📚 إيراد المادة الأقوى: ${top.nom} (${money(top.revenue)})\n${lines}`,
            `📚 Meilleure matière : ${top.nom} (${money(top.revenue)})\n${lines}`
          )
        );
      }

      case "revenue_by_prof": {
        const d = await getAdminDashboardMonthData(centerId, monthKey(now));
        if (d.profs.length === 0) {
          return fallback(pick(lang, "لا يوجد أساتذة بعد.", "Aucun professeur."));
        }
        const lines = d.profs
          .sort((a, b) => b.netRevenue - a.netRevenue)
          .map((p) => `• ${p.prof.prenom} ${p.prof.nom}: ${money(p.netRevenue)} (ربح المركز ${money(p.beneficeCentre)})`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `👨‍🏫 إيرادات الأساتذة (${monthKey(now)}):\n${lines}\n` +
              `الإجمالي: ${money(d.netPaidSessionsRevenue)} | ربح المركز: ${money(d.netCenterEarnings)}`,
            `👨‍🏫 Revenus des profs (${monthKey(now)}):\n${lines}\n` +
              `Total : ${money(d.netPaidSessionsRevenue)} | Centre : ${money(d.netCenterEarnings)}`
          )
        );
      }

      case "profit_prof_detail": {
        const d = await getAdminDashboardMonthData(centerId, monthKey(now));
        const prof = await findBestMatch(
          rawMessage,
          d.profs.map((p) => ({
            id: p.prof.id,
            search: `${p.prof.prenom} ${p.prof.nom}`.toLowerCase(),
          }))
        );
        if (!prof) {
          return fallback(
            pick(
              lang,
              "لم أجد أستاذًا بهذا الاسم في مركزك. أعد السؤال مع ذكر الاسم كاملًا، أو اسأل «ربح كل استاذ».",
              "Je n'ai pas trouvé ce professeur. Précisez le nom complet ou demandez « gains de chaque prof »."
            )
          );
        }
        const matched = d.profs.find((p) => p.prof.id === prof.id);
        const fin = await getTeacherDashboardFinance(centerId, prof.id);
        return fallback(
          pick(
            lang,
            `👤 ${matched!.prof.prenom} ${matched!.prof.nom} — ${monthKey(now)}\n` +
              `إيراد الحصص: ${money(matched!.netRevenue)}\n` +
              `حصة المركز: ${money(matched!.beneficeCentre)} (${matched!.taux}%)\n` +
              `أجر الأستاذ: ${money(matched!.salaireProf)}\n` +
              `قابل للصرف (claimable): ${money(fin.claimable)}`,
            `👤 ${matched!.prof.prenom} ${matched!.prof.nom} — ${monthKey(now)}\n` +
              `Revenu séances : ${money(matched!.netRevenue)}\n` +
              `Part centre : ${money(matched!.beneficeCentre)} (${matched!.taux}%)\n` +
              `Salaire prof : ${money(matched!.salaireProf)}\n` +
              `À réclamer (claimable) : ${money(fin.claimable)}`
          )
        );
      }

      // ─────────────────────────── IMPAYÉS (rôle-aware) ─────────────────────
      case "unpaid_total": {
        const u = await unpaidRows(centerId, parsed.period, now, isProf ? userId : undefined);
        const periodTxt = parsed.period === "all" ? "" : parsed.period === "month" ? " هذا الشهر" : " هذه الفترة";
        const scopeTxt = isProf ? " في مجموعاتك" : "";
        return fallback(
          pick(
            lang,
            `💳 إجمالي المتأخرات${scopeTxt}${periodTxt}: ${money(u.total)}\n` +
              `عدد المديونين: ${int(u.count)}`,
            `💳 Total impayés${isProf ? " de vos groupes" : ""}${parsed.period === "month" ? " du mois" : ""}: ${money(u.total)}\n` +
              `Débiteurs : ${int(u.count)}`
          )
        );
      }

      case "unpaid_list": {
        const u = await unpaidRows(centerId, parsed.period, now, isProf ? userId : undefined);
        if (u.rows.length === 0) {
          return fallback(
            pick(
              lang,
              isProf ? "رائع — لا يوجد أي مدين في مجموعاتك." : "رائع — لا يوجد أي تلميذ متأخر.",
              isProf ? "Parfait — aucun impayé dans vos groupes." : "Parfait — aucun impayé."
            )
          );
        }
        const lines = u.rows
          .slice(0, 8)
          .map((r, i) => `${i + 1}. ${r.prenom} ${r.nom} — ${money(r.remaining)} (${r.groupeNom})`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `🔻 ${isProf ? "مديونو مجموعاتك" : "المتأخرون"} (${int(u.count)}) — إجمالي ${money(u.total)}:\n${lines}` +
              (u.rows.length > 8 ? `\n… والبقية (${u.rows.length - 8})` : ""),
            `🔻 ${isProf ? "Débiteurs de vos groupes" : "Débiteurs"} (${int(u.count)}) — total ${money(u.total)}:\n${lines}` +
              (u.rows.length > 8 ? `\n… et ${u.rows.length - 8} autres` : "")
          )
        );
      }

      // ─────────────────────────── PRÉSENCES / ABSENCES ─────────────────────
      case "attendance_rate": {
        const c = await attendanceCounts(scope, parsed.period, now);
        if (c.total === 0) {
          return fallback(pick(lang, "لا توجد بيانات حضور لهذه الفترة.", "Aucune donnée de présence sur cette période."));
        }
        const presPct = Math.round((c.present / c.total) * 100);
        const absPct = 100 - presPct;
        return fallback(
          pick(
            lang,
            `📋 حضور هذا الشهر: ${int(c.present)} حضور / ${int(c.absent)} غياب\n` +
              `نسبة الحضور: ${presPct}% | نسبة الغياب: ${absPct}%`,
            `📋 Présences : ${int(c.present)} présents / ${int(c.absent)} absents\n` +
              `Taux de présence : ${presPct}% | d'absence : ${absPct}%`
          )
        );
      }

      case "absent_today": {
        const rows = await absentList(scope, "today", now);
        if (rows.length === 0) {
          return fallback(pick(lang, "🥳 لا غياب اليوم — الجميع حاضر.", "🥳 Aucune absence aujourd'hui."));
        }
        const lines = rows
          .slice(0, 15)
          .map((r) => `• ${r.prenom} ${r.nom} — ${r.groupeNom}${r.heure ? ` (${r.heure})` : ""}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `🚶 غياب اليوم (${int(rows.length)}):\n${lines}` + (rows.length > 15 ? `\n… والبقية (${rows.length - 15})` : ""),
            `🚶 Absents d'aujourd'hui (${int(rows.length)}):\n${lines}` + (rows.length > 15 ? `\n… ${rows.length - 15} autres` : "")
          )
        );
      }

      case "most_absent_students": {
        const rows = await mostAbsentStudents(scope, parsed.period, 5, now);
        if (rows.length === 0) {
          return fallback(pick(lang, "لا يوجد غياب مسجل لهذه الفترة.", "Aucune absence enregistrée sur cette période."));
        }
        const lines = rows.map((r, i) => `${i + 1}. ${r.prenom} ${r.nom} — ${int(r.count)} غياب`).join("\n");
        return fallback(
          pick(
            lang,
            `🏆 الأكثر غيابًا ${isProf ? "في مجموعاتك" : ""}:\n${lines}`,
            `🏆 Les plus absents ${isProf ? "de vos groupes" : ""}:\n${lines}`
          )
        );
      }

      case "most_absent_groups": {
        const rows = await mostAbsentGroups(centerId, parsed.period, 5, now);
        if (rows.length === 0) {
          return fallback(pick(lang, "لا يوجد غياب مسجل لهذه الفترة.", "Aucune absence enregistrée."));
        }
        const lines = rows.map((r, i) => `${i + 1}. ${r.nom} — ${int(r.count)} غياب`).join("\n");
        return fallback(pick(lang, `🥇 مجموعات الأكثر غيابًا:\n${lines}`, `🥇 Groupes les plus absents:\n${lines}`));
      }

      case "most_absent_profs": {
        const rows = await mostAbsentProfs(centerId, parsed.period, 5, now);
        if (rows.length === 0) {
          return fallback(pick(lang, "لا يوجد غياب مسجل لهذه الفترة.", "Aucune absence enregistrée."));
        }
        const lines = rows.map((r, i) => `${i + 1}. ${r.prenom} ${r.nom} — ${int(r.count)} غياب (طلابه)`).join("\n");
        return fallback(
          pick(
            lang,
            `🥇 الأساتذة حسب غياب طلبتهم:\n${lines}`,
            `🥇 Profs selon les absences de leurs élèves:\n${lines}`
          )
        );
      }

      // ─────────────────────────── DÉNOMBREMENTS ────────────────────────────
      case "counts": {
        const [e, p, g, m, s] = await Promise.all([
          prisma.utilisateur.count({ where: { role: "eleve", centerId, deletedAt: null, ghost: false } }),
          prisma.utilisateur.count({ where: { role: "prof", centerId, deletedAt: null, ghost: false } }),
          prisma.groupe.count({ where: { centerId } }),
          prisma.matiere.count({ where: { centerId } }),
          prisma.seance.count({ where: { statut: "terminee", groupe: { centerId } } }),
        ]);
        return fallback(
          pick(
            lang,
            `👥 تلاميذ: ${int(e)}\n👨‍🏫 أساتذة: ${int(p)}\n🧩 مجموعات: ${int(g)}\n📚 مواد: ${int(m)}\n✅ حصص منتهية: ${int(s)}`,
            `👥 Élèves : ${int(e)}\n👨‍🏫 Profs : ${int(p)}\n🧩 Groupes : ${int(g)}\n📚 Matières : ${int(m)}\n✅ Séances terminées : ${int(s)}`
          )
        );
      }

      // ─────────────────────────── SÉANCES ──────────────────────────────────
      case "seances": {
        const rows = await seancesInRange(scope, parsed.period, now);
        if (rows.length === 0) {
          return fallback(
            pick(
              lang,
              parsed.period === "today"
                ? "لا توجد حصص اليوم (أو تم إلغاؤها)."
                : "لا توجد حصص هذه الفترة.",
              parsed.period === "today"
                ? "Aucune séance aujourd'hui."
                : "Aucune séance sur cette période."
            )
          );
        }
        const lines = rows
          .slice(0, 20)
          .map((r) => `• ${r.date}${r.heure ? ` ${r.heure}` : ""} — ${r.groupeNom}${r.matiere ? ` (${r.matiere})` : ""}${r.prof ? ` — ${r.prof.prenom} ${r.prof.nom}` : ""}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            (parsed.period === "today" ? "📅 حصص اليوم" : "📅 الحصص القادمة") + ` (${int(rows.length)}):\n${lines}`,
            (parsed.period === "today" ? "📅 Séances du jour" : "📅 Séances") + ` (${int(rows.length)}):\n${lines}`
          )
        );
      }

      case "seances_next": {
        const fromDay = startOfDayLocal(now);
        const toDay = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        toDay.setHours(23, 59, 59, 999);
        const rows = await prisma.seance.findMany({
          where: {
            date: { gte: fromDay, lte: toDay },
            statut: { not: "annulee" },
            groupe: { centerId, ...(isProf ? { profId: userId } : {}) },
          },
          orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
          select: {
            date: true,
            heureDebut: true,
            groupe: {
              select: {
                nom: true,
                matiere: { select: { nom: true } },
                prof: { select: { prenom: true, nom: true } },
              },
            },
          },
        });
        const upcoming = rows.filter((r) => r.date >= startOfDayLocal(now) && r.date <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));
        const lines = upcoming
          .slice(0, 15)
          .map((r) => {
            const d = new Date(r.date);
            const dt = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const t = r.heureDebut ? `${String(r.heureDebut.getUTCHours()).padStart(2, "0")}:${String(r.heureDebut.getUTCMinutes()).padStart(2, "0")}` : "";
            return `• ${dt}${t ? ` ${t}` : ""} — ${r.groupe.nom}${r.groupe.matiere ? ` (${r.groupe.matiere.nom})` : ""}`;
          })
          .join("\n");
        if (upcoming.length === 0) {
          return fallback(pick(lang, "لا توجد حصص في الأيام الثلاثة القادمة.", "Aucune séance dans les 3 prochains jours."));
        }
        return fallback(
          pick(
            lang,
            `🔜 الحصص القادمة (3 أيام, ${int(upcoming.length)}):\n${lines}`,
            `🔜 Séances à venir (3 jours, ${int(upcoming.length)}):\n${lines}`
          )
        );
      }

      case "unverified_seances": {
        const rows = await unverifiedSeances(scope);
        if (rows.length === 0) {
          return fallback(pick(lang, "لا توجد حصص منتهية بلا حضور.", "Aucune séance terminée sans présence."));
        }
        const lines = rows
          .map((r) => `• ${r.date}${r.heure ? ` ${r.heure}` : ""} — ${r.groupeNom}${r.matiere ? ` (${r.matiere})` : ""}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `⚠️ حصص منتهية بدون تصريح حضور (${int(rows.length)}):\n${lines}`,
            `⚠️ Séances terminées sans présence (${int(rows.length)}):\n${lines}`
          )
        );
      }

      // ─────────────────────────── RATTRAPAGE ───────────────────────────────
      case "rattrapage":
      case "my_rattrapage": {
        const rows = await rattrapageSeances(scope, parsed.period, now);
        if (rows.length === 0) {
          return fallback(
            pick(
              lang,
              "لا توجد حصص تعويض لهذه الفترة.",
              "Aucune séance de rattrapage sur cette période."
            )
          );
        }
        const lines = rows
          .slice(0, 6)
          .map((r) => `• ${r.date}${r.heure ? ` ${r.heure}` : ""} — ${r.groupeNom}${r.prof ? ` (${r.prof})` : ""} — ${int(r.n)} تلميذ`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `🔁 التعويضات (${int(rows.length)}):\n${lines}`,
            `🔁 Rattrapages (${int(rows.length)}):\n${lines}`
          )
        );
      }

      // ─────────────────────────── GROUPES / ÉLÈVES ─────────────────────────
      case "groupes_by_matiere": {
        const matieres = await prisma.matiere.findMany({
          where: { centerId },
          select: { id: true, nom: true },
        });
        const match = await findBestMatch(
          rawMessage,
          matieres.map((m) => ({ ...m, search: m.nom.toLowerCase() }))
        );
        const target = match ?? null;
        const groups = await prisma.groupe.findMany({
          where: { centerId, ...(target ? { matiereId: target.id } : {}) },
          select: {
            id: true,
            nom: true,
            matiere: { select: { nom: true } },
            prof: { select: { prenom: true, nom: true } },
            _count: { select: { inscriptions: { where: { statut: "actif" } } } },
          },
        });
        if (groups.length === 0) {
          return fallback(
            pick(
              lang,
              target
                ? `لا توجد مجموعات لمادة ${match!.nom}.`
                : "لا توجد مجموعات مسجلة.",
              target
                ? `Aucun groupe pour la matière ${match!.nom}.`
                : "Aucun groupe enregistré."
            )
          );
        }
        const lines = groups
          .map((g) => `• ${g.nom}${g.matiere ? ` (${g.matiere.nom})` : ""}${g.prof ? ` — ${g.prof.prenom} ${g.prof.nom}` : ""} — ${int(g._count.inscriptions)} تلميذ`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `🧩 المجموعات${match ? ` — ${match.nom}` : ""} (${int(groups.length)}):\n${lines}`,
            `🧩 Groupes${match ? ` — ${match.nom}` : ""} (${int(groups.length)}):\n${lines}`
          )
        );
      }

      case "group_students": {
        const groupes = await prisma.groupe.findMany({
          where: { centerId, ...(isProf ? { profId: userId } : {}) },
          select: { id: true, nom: true },
        });
        if (groupes.length === 0) {
          return fallback(pick(lang, "لا توجد مجموعات.", "Aucun groupe."));
        }
        const match = await findBestMatch(rawMessage, groupes.map((g) => ({ ...g, search: g.nom.toLowerCase() })));
        let target = match;
        const allGroups = !target && isProf && [/مجموع[تاي]/.test(rawMessage), groupes.length > 0].every(Boolean);
        if (!target && isProf && groupes.length === 1) target = { ...groupes[0], search: groupes[0].nom.toLowerCase() };
        if (!target && allGroups) {
          const blocks: string[] = [];
          for (const g of groupes) {
            const list = await prisma.inscription.findMany({
              where: { groupeId: g.id, statut: "actif" },
              select: { eleve: { select: { prenom: true, nom: true, classe: true } } },
              orderBy: [{ eleve: { prenom: "asc" } }],
            });
            blocks.push(
              `🧩 ${g.nom} — ${int(list.length)} تلميذًا` +
                (list.length === 0 ? "" : `\n${list.map((i, idx) => `${idx + 1}. ${i.eleve.prenom} ${i.eleve.nom}${i.eleve.classe ? ` (${i.eleve.classe})` : ""}`).join("\n")}`)
            );
          }
          return fallback(pick(lang, `👨‍🎓 تلاميذ مجموعاتك:\n${blocks.join("\n\n")}`, `👨‍🎓 Vos groupes:\n${blocks.join("\n\n")}`));
        }
        if (!target) {
          const names = groupes.map((g) => g.nom).join("، ");
          return fallback(
            pick(
              lang,
              isProf
                ? `أي مجموعة؟ عندك: ${names}. أعد السؤال مع اسمها.`
                : `أي مجموعة؟ أذكر الاسم. المجموعات: ${names}`,
              isProf
                ? `Quel groupe ? Vous avez : ${names}. Précisez le nom.`
                : `Quel groupe ? Précisez le nom. Les groupes : ${names}`
            )
          );
        }
        const eleves = await prisma.inscription.findMany({
          where: { groupeId: target.id, statut: "actif" },
          select: {
            eleve: {
              select: { prenom: true, nom: true, niveau: true, classe: true, telephone: true },
            },
          },
          orderBy: [{ eleve: { prenom: "asc" } }],
        });
        if (eleves.length === 0) {
          return fallback(pick(lang, `لا يوجد تلاميذ في المجموعة ${target.nom}.`, `Aucun élève dans le groupe ${target.nom}.`));
        }
        const lines = eleves
          .map((i, idx) => `${idx + 1}. ${i.eleve.prenom} ${i.eleve.nom}${i.eleve.classe ? ` (${i.eleve.classe})` : ""}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `👨‍🎓 ${target.nom} — ${int(eleves.length)} تلميذًا:\n${lines}`,
            `👨‍🎓 ${target.nom} — ${int(eleves.length)} élèves:\n${lines}`
          )
        );
      }

      case "student_attendance": {
        const students = await candidateStudents(centerId, isProf ? userId : undefined);
        const match = await findBestMatch(rawMessage, students);
        if (!match) {
          return fallback(
            pick(
              lang,
              "لم أجد تلميذًا بهذا الاسم. تحقق من الإملاء واذكر الاسم الكامل.",
              "Je n'ai pas trouvé cet élève. Précisez le nom complet."
            )
          );
        }
        const { from, to } = periodRange(parsed.period, now);
        const rows = (await prisma.presence.groupBy({
          by: ["statut"],
          where: {
            eleveId: match.id,
            seance: {
              date: { gte: from ?? undefined, lte: to ?? undefined },
              statut: { not: "annulee" },
              groupe: { centerId, ...(isProf ? { profId: userId } : {}) },
            },
          },
          _count: true,
        })) as unknown as { statut: string; _count: number }[];
        let present = 0;
        let absent = 0;
        for (const r of rows) {
          if (r.statut === "present") present = r._count;
          else absent = r._count;
        }
        const total = present + absent;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        const lastDate = await prisma.presence.findFirst({
          where: { eleveId: match.id, seance: { groupe: { centerId, ...(isProf ? { profId: userId } : {}) } } },
          orderBy: { seance: { date: "desc" } },
          select: { seance: { select: { date: true } } },
        });
        return fallback(
          pick(
            lang,
            `👤 ${match.prenom} ${match.nom}\n` +
              `حضور: ${int(present)} | غياب: ${int(absent)} | نسبة الحضور: ${pct}%\n` +
              (lastDate ? `آخر تسجيل: ${lastDate.seance.date.toISOString().slice(0, 10)}` : ""),
            `👤 ${match.prenom} ${match.nom}\n` +
              `Présences : ${int(present)} | absences : ${int(absent)} | taux : ${pct}%\n` +
              (lastDate ? `Dernier pointage : ${lastDate.seance.date.toISOString().slice(0, 10)}` : "")
          )
        );
      }

      // ─────────────────────────── PROF ─────────────────────────────────────
      case "my_finance": {
        const taux = await prisma.tauxBenefice.findUnique({ where: { profId: userId } });
        const share = 100 - centerSharePercent(taux);
        const fin = await getTeacherDashboardFinance(centerId, userId);
        return fallback(
          pick(
            lang,
            `💵 حصتك ${share}%:\n` +
              `المستحق لك (claimable): ${money(fin.claimable)}\n` +
              `المتأخر الصافي (impayé): ${money(fin.impayeNet)}`,
            `💵 Votre part ${share}%:\n` +
              `À réclamer (claimable) : ${money(fin.claimable)}\n` +
              `Impayé net : ${money(fin.impayeNet)}`
          )
        );
      }

      case "my_remaining_seances": {
        const { from, to } = periodRange("month", now);
        const fromToday = startOfDayLocal(now);
        const groupes = await prisma.groupe.findMany({
          where: { profId: userId },
          select: { id: true, nom: true },
        });
        if (groupes.length === 0) {
          return fallback(pick(lang, "لا توجد مجموعات لك.", "Aucun groupe pour vous."));
        }
        const seances = await prisma.seance.groupBy({
          by: ["groupeId", "statut"],
          where: {
            groupeId: { in: groupes.map((g) => g.id) },
            date: { gte: from ?? undefined, lte: to ?? undefined },
            statut: { not: "annulee" },
          },
          _count: true,
        });
        const upcoming = await prisma.seance.count({
          where: {
            groupeId: { in: groupes.map((g) => g.id) },
            date: { gte: fromToday, lte: to ?? undefined },
            statut: { in: ["planifiee", "en_cours"] },
          },
        });
        const lines = groupes.map((g) => {
          const rows = seances.filter((s) => s.groupeId === g.id);
          const term = Number(rows.find((s) => s.statut === "terminee")?._count ?? 0);
          const plan = Number(rows.find((s) => s.statut === "planifiee")?._count ?? 0);
          return `• ${g.nom}: ${int(plan)} مجدولة / ${int(term)} منتهية`;
        });
        return fallback(
          pick(
            lang,
            `📅 هذا الشهر في مجموعاتك:\n${lines.join("\n")}\n` +
              `حتى نهاية الشهر، المتبقي لك: ${int(upcoming)} حصة`,
            `📅 Vos groupes ce mois:\n${lines.join("\n")}\n` +
              `Restantes à assurer ce mois : ${int(upcoming)}`
          )
        );
      }

      // ─────────────────────────── BRIEFS & DÉCISION (admin) ───────────────
      case "daily_brief": {
        const [rev, seances, abs, unpaid, unv, ratt] = await Promise.all([
          revenueToday(centerId, now),
          seancesInRange(scope, "today", now),
          absentList(scope, "today", now),
          unpaidRows(centerId, "month", now),
          prisma.seance.count({
            where: { statut: "terminee", presences: { none: {} }, groupe: { centerId } },
          }),
          rattrapageSeances(scope, "today", now),
        ]);
        const dateTxt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return fallback(
          pick(
            lang,
            `📋 ملخص اليوم (${dateTxt}):\n` +
              `💵 تحصيل اليوم: ${money(rev.total)} (${int(rev.count)} عملية)\n` +
              `📅 حصص اليوم: ${int(seances.length)} · 🚶 غياب: ${int(abs.length)}\n` +
              `💳 متأخرات الشهر: ${money(unpaid.total)} (${int(unpaid.count)} مدين)\n` +
              `⚠️ حصص منتهية بلا حضور: ${int(unv)} · 🔁 تعويضات اليوم: ${int(ratt.length)}`,
            `📋 Résumé du jour (${dateTxt}):\n` +
              `💵 Encaissé aujourd'hui : ${money(rev.total)} (${int(rev.count)} opérations)\n` +
              `📅 Séances du jour : ${int(seances.length)} · 🚶 Absents : ${int(abs.length)}\n` +
              `💳 Impayés du mois : ${money(unpaid.total)} (${int(unpaid.count)} débiteurs)\n` +
              `⚠️ Séances sans pointage : ${int(unv)} · 🔁 Rattrapages du jour : ${int(ratt.length)}`
          )
        );
      }

      case "monthly_brief": {
        const mk = monthKey(now);
        const [d, unpaid, att, col, news, unv, students] = await Promise.all([
          getAdminDashboardMonthData(centerId, mk),
          unpaidRows(centerId, "month", now),
          attendanceCounts(scope, "month", now),
          collectionStats(centerId, now),
          newStudentsMonth(centerId, now),
          prisma.seance.count({
            where: { statut: "terminee", presences: { none: {} }, groupe: { centerId } },
          }),
          prisma.utilisateur.count({ where: { role: "eleve", centerId, deletedAt: null, ghost: false } }),
        ]);
        const attTxt = att.total > 0 ? `${Math.round((att.present / att.total) * 100)}%` : "—";
        return fallback(
          pick(
            lang,
            `📈 ملخص ${mk}:\n` +
              `💼 ربح المركز: ${money(d.netCenterEarnings)} · إيراد الحصص: ${money(d.netPaidSessionsRevenue)}\n` +
              `👨‍🏫 أجور الأساتذة: ${money(Math.max(0, d.netPaidSessionsRevenue - d.netCenterEarnings))}\n` +
              `💳 متأخرات: ${money(unpaid.total)} (${int(unpaid.count)}) · تحصيل: ${Math.round(col.rate * 100)}%\n` +
              `📋 حضور الشهر: ${attTxt} · تلاميذ نشطون: ${int(students)}\n` +
              `🆕 منضمون: ${int(news.count)} · ⚠️ حصص بلا حضور: ${int(unv)}`,
            `📈 Résumé ${mk}:\n` +
              `💼 Bénéfice du centre : ${money(d.netCenterEarnings)} · Revenu séances : ${money(d.netPaidSessionsRevenue)}\n` +
              `👨‍🏫 Salaires profs : ${money(Math.max(0, d.netPaidSessionsRevenue - d.netCenterEarnings))}\n` +
              `💳 Impayés : ${money(unpaid.total)} (${int(unpaid.count)}) · Recouvrement : ${Math.round(col.rate * 100)}%\n` +
              `📋 Présence du mois : ${attTxt} · Élèves actifs : ${int(students)}\n` +
              `🆕 Inscrits : ${int(news.count)} · ⚠️ Séances sans pointage : ${int(unv)}`
          )
        );
      }

      case "health_score": {
        const [att, col, u, churn, students] = await Promise.all([
          attendanceCounts(scope, "month", now),
          collectionStats(centerId, now),
          unpaidRows(centerId, "all", now),
          churnRisk(centerId, 14, now),
          prisma.utilisateur.count({ where: { role: "eleve", centerId, deletedAt: null, ghost: false } }),
        ]);
        const attRate = att.total > 0 ? att.present / att.total : 1;
        const colRate = col.rate;
        const debtPct = students > 0 ? u.count / students : 0;
        const churnPct = students > 0 ? Math.min(1, churn.length / (students * 0.5)) : 0;
        const attScore = Math.round(attRate * 30);
        const colScore = Math.round(colRate * 35);
        const debtScore = Math.round((1 - Math.min(1, debtPct)) * 20);
        const churnScore = Math.round((1 - churnPct) * 15);
        const score = attScore + colScore + debtScore + churnScore;
        const verdict = score >= 80 ? "ممتاز 🏆" : score >= 60 ? "جيد ✅" : score >= 40 ? "متوسط ⚠️" : "تحتاج تدخلًا 🚨";
        return fallback(
          pick(
            lang,
            `🩺 مؤشر صحة المركز: ${int(score)}/100 (${verdict})\n` +
              `• الحضور: ${int(attScore)}/30 (${Math.round(attRate * 100)}%)\n` +
              `• التحصيل: ${int(colScore)}/35 (${Math.round(colRate * 100)}%)\n` +
              `• المديونية: ${int(debtScore)}/20 (${int(u.count)} من ${int(students)} مدين)\n` +
              `• النشاط: ${int(churnScore)}/15 (${int(churn.length)} متوقف عن الحضور)`,
            `🩺 Indice de santé : ${int(score)}/100 (${verdict === "ممتاز 🏆" ? "Excellent 🏆" : verdict === "جيد ✅" ? "Bon ✅" : verdict === "متوسط ⚠️" ? "Moyen ⚠️" : "A surveiller 🚨"})\n` +
              `• Présence : ${int(attScore)}/30 (${Math.round(attRate * 100)}%)\n` +
              `• Recouvrement : ${int(colScore)}/35 (${Math.round(colRate * 100)}%)\n` +
              `• Dettes : ${int(debtScore)}/20 (${int(u.count)} / ${int(students)} débiteurs)\n` +
              `• Activité : ${int(churnScore)}/15 (${int(churn.length)} inactifs)`
          )
        );
      }

      case "collection_rate": {
        const col = await collectionStats(centerId, now);
        const remaining = Math.max(0, col.due - col.paid);
        return fallback(
          pick(
            lang,
            `💳 نسبة التحصيل ${monthKey(now)}: ${Math.round(col.rate * 100)}%\n` +
              `مسدَّد: ${money(col.paid)} · المستحق: ${money(col.due)}\n` +
              `المتبقي على التحصيل: ${money(remaining)}`,
            `💳 Taux de recouvrement ${monthKey(now)} : ${Math.round(col.rate * 100)}%\n` +
              `Payé : ${money(col.paid)} · Dû : ${money(col.due)}\n` +
              `Reste à encaisser : ${money(remaining)}`
          )
        );
      }

      case "projection": {
        const mk = monthKey(now);
        const d = await getAdminDashboardMonthData(centerId, mk);
        const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const elapsed = now.getDate();
        const projected = Math.round(((d.netPaidSessionsRevenue / elapsed) * dim + Number.EPSILON) * 100) / 100;
        const centerProj =
          d.netPaidSessionsRevenue > 0
            ? Math.round((d.netCenterEarnings / d.netPaidSessionsRevenue) * projected * 100) / 100
            : 0;
        const remaining = Math.max(0, Math.round((projected - d.netPaidSessionsRevenue) * 100) / 100);
        return fallback(
          pick(
            lang,
            `🔮 توقعات ${mk}:\n` +
              `إيراد الحصص حتى الآن: ${money(d.netPaidSessionsRevenue)} (يوم ${int(elapsed)} من ${int(dim)})\n` +
              `بالوتيرة الحالية → نهاية الشهر: ~${money(projected)}\n` +
              `حصة المركز عند نهاية الشهر: ~${money(centerProj)}\n` +
              `ما تبقى لتحصيله: ${money(remaining)}`,
            `🔮 Prévision ${mk}:\n` +
              `Revenu actuel : ${money(d.netPaidSessionsRevenue)} (jour ${int(elapsed)}/${int(dim)})\n` +
              `Rythme actuel → fin de mois : ~${money(projected)}\n` +
              `Part du centre fin de mois : ~${money(centerProj)}\n` +
              `Reste à encaisser : ${money(remaining)}`
          )
        );
      }

      case "at_risk_students": {
        const u = await unpaidRows(centerId, "all", now);
        if (u.rows.length === 0) {
          return fallback(pick(lang, "رائع — لا يوجد أي تلميذ متأخر.", "Parfait — aucun débiteur."));
        }
        const delayed = u.rows.map((r) => ({
          ...r,
          days: r.lastPaid ? Math.floor((now.getTime() - r.lastPaid.getTime()) / 86400000) : null,
        }));
        const lines = delayed
          .slice(0, 8)
          .map(
            (r, i) =>
              `${i + 1}. ${r.prenom} ${r.nom} — ${money(r.remaining)} (${r.groupeNom}) · ${
                r.days === null ? "بلا أي دفع سابق" : r.days > 30 ? `آخر دفع قبل ${int(r.days)} يوم 🔴` : `آخر دفع قبل ${int(r.days)} يوم`
              }`
          )
          .join("\n");
        return fallback(
          pick(
            lang,
            `🚨 تلاميذ الخطر (${int(delayed.length)} بإجمالي ${money(u.total)}):\n${lines}\n` +
              `💡 رتبهم من الأكبر دينًا واتصل بهم أو فعّل التذكير بالدفع.`,
            `🚨 Élèves à risque (${int(delayed.length)}, total ${money(u.total)}):\n${lines}\n` +
              `💡 Classez-les par dette et relancez-les.`
          )
        );
      }

      case "debtors_by_group": {
        const u = await unpaidRows(centerId, "all", now);
        if (u.rows.length === 0) {
          return fallback(pick(lang, "لا توجد متأخرات.", "Aucun impayé."));
        }
        const byG = new Map<string, { cnt: number; sum: number }>();
        for (const r of u.rows) {
          const cur = byG.get(r.groupeNom) ?? { cnt: 0, sum: 0 };
          cur.cnt++;
          cur.sum = Math.round((cur.sum + r.remaining) * 100) / 100;
          byG.set(r.groupeNom, cur);
        }
        const lines = [...byG.entries()]
          .sort((a, b) => b[1].sum - a[1].sum)
          .map(([g, v]) => `• ${g}: ${int(v.cnt)} — ${money(v.sum)}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `📦 المتأخرات حسب المجموعة (إجمالي ${money(u.total)}):\n${lines}`,
            `📦 Impayés par groupe (total ${money(u.total)}):\n${lines}`
          )
        );
      }

      case "churn_risk": {
        const rows = await churnRisk(centerId, 14, now);
        if (rows.length === 0) {
          return fallback(pick(lang, "لا يوجد تلاميذ توقفوا عن الحضور مؤخرًا.", "Aucun élève inactif récemment."));
        }
        const lines = rows
          .slice(0, 8)
          .map((r) => `• ${r.prenom} ${r.nom} — ${r.groupeNom}${r.lastDate ? ` · آخر حضور ${r.lastDate.toISOString().slice(0, 10)}` : ""}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `🚶 متوقفون عن الحضور (14 يومًا الأخيرة, ${int(rows.length)}):\n${lines}\n` +
              `💡 راجعهم للاطمئنان أو أرخِف الإثر من التسجيل.`,
            `🚶 Inactifs depuis 14 jours (${int(rows.length)}):\n${lines}\n` +
              `💡 À relancer ou à archiver.`
          )
        );
      }

      case "new_students": {
        const { count, rows } = await newStudentsMonth(centerId, now);
        if (count === 0) {
          return fallback(pick(lang, "لا يوجد منضمون جدد هذا الشهر.", "Aucune nouvelle inscription ce mois-ci."));
        }
        const lines = rows
          .slice(0, 8)
          .map((r) => `• ${r.prenom} ${r.nom}${r.classe ? ` (${r.classe})` : ""} — ${r.createdAt.toISOString().slice(0, 10)}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `🆕 من انضم هذا الشهر (${int(count)}):\n${lines}`,
            `🆕 Nouvelles inscriptions du mois (${int(count)}):\n${lines}`
          )
        );
      }

      case "payment_habits": {
        const { methods, bestMonth } = await paymentMethods(centerId, now);
        if (methods.length === 0) {
          return fallback(pick(lang, "لا توجد مدفوعات مسجلة هذا الشهر بعد.", "Aucun paiement ce mois-ci."));
        }
        const labels: Record<string, string> = {
          especes: "نقدًا",
          virement: "تحويل بنكي",
          cheque: "شيك",
          autre: "غير ذلك",
        };
        const frLabels: Record<string, string> = {
          especes: "Espèces",
          virement: "Virement",
          cheque: "Chèque",
          autre: "Autre",
        };
        const lines = methods.map((m) => `• ${lang === "ar" ? labels[m.methode] ?? m.methode : frLabels[m.methode] ?? m.methode}: ${money(m.total)} (${int(m.nb)} عملية)`).join("\n");
        const bestTxt = bestMonth
          ? `\n🏆 أفضل شهر تحصيل (آخر 6): ${bestMonth.ym} — ${money(bestMonth.total)}`
          : "";
        return fallback(
          pick(
            lang,
            `💳 طرق الدفع — ${monthKey(now)}:\n${lines}${bestTxt}`,
            `💳 Méthodes de paiement — ${monthKey(now)}:\n${lines}${bestTxt}`
          )
        );
      }

      case "student_profile": {
        const students = await candidateStudents(centerId, isProf ? userId : undefined);
        const match = await findBestMatch(rawMessage, students);
        if (!match) {
          return fallback(
            pick(
              lang,
              "لم أجد تلميذًا بهذا الاسم. تحقق من الإملاء واذكر الاسم الكامل.",
              "Je n'ai pas trouvé cet élève. Précisez le nom complet."
            )
          );
        }
        const p = await studentProfileData(centerId, match.id, isProf ? userId : undefined, now);
        const balTxt = p.netBalance >= 0 ? "رصيد مسبق" : "متأخر المحفظة";
        const balFr = p.netBalance >= 0 ? "Solde prépayé" : "Déficit de portefeuille";
        const nextTxt =
          p.nextSeance && p.nextSeance.heure
            ? `${p.nextSeance.date.toISOString().slice(0, 10)} ${p.nextSeance.heure} — ${p.nextSeance.groupeNom}`
            : p.nextSeance
              ? `${p.nextSeance.date.toISOString().slice(0, 10)} — ${p.nextSeance.groupeNom}`
              : "لا توجد حصة قادمة";
        const nextFr =
          p.nextSeance && p.nextSeance.heure
            ? `${p.nextSeance.date.toISOString().slice(0, 10)} ${p.nextSeance.heure} — ${p.nextSeance.groupeNom}`
            : p.nextSeance
              ? `${p.nextSeance.date.toISOString().slice(0, 10)} — ${p.nextSeance.groupeNom}`
              : "aucune séance à venir";
        return fallback(
          pick(
            lang,
            `👤 ${match.prenom} ${match.nom}${match.classe ? ` — ${match.classe}` : ""}\n` +
              `${match.telephone ? `📱 ${match.telephone} · ` : ""}🧩 ${p.groupes.join("، ") || "بدون مجموعة"}\n` +
              `💳 ${balTxt}: ${money(Math.abs(p.netBalance))}\n` +
              `📋 حضور: ${int(p.present)}/${int(p.total)} (${p.pct}%)${p.lastDate ? ` · آخر: ${p.lastDate.toISOString().slice(0, 10)}` : ""}\n` +
              `🔜 الحصة القادمة: ${nextTxt}`,
            `👤 ${match.prenom} ${match.nom}${match.classe ? ` — ${match.classe}` : ""}\n` +
              `${match.telephone ? `📱 ${match.telephone} · ` : ""}🧩 ${p.groupes.join(", ") || "sans groupe"}\n` +
              `💳 ${balFr}: ${money(Math.abs(p.netBalance))}\n` +
              `📋 Présences : ${int(p.present)}/${int(p.total)} (${p.pct}%)${p.lastDate ? ` · dernier : ${p.lastDate.toISOString().slice(0, 10)}` : ""}\n` +
              `🔜 Prochaine séance : ${nextFr}`
          )
        );
      }

      case "prof_info": {
        const mk = monthKey(now);
        const d = await getAdminDashboardMonthData(centerId, mk);
        const prof = await findBestMatch(
          rawMessage,
          d.profs.map((p) => ({ id: p.prof.id, search: `${p.prof.prenom} ${p.prof.nom}`.toLowerCase() }))
        );
        if (!prof) {
          return fallback(
            pick(
              lang,
              "لم أجد أستاذًا بهذا الاسم في مركزك. أعد السؤال مع ذكر الاسم كاملًا.",
              "Je n'ai pas trouvé ce professeur. Précisez le nom complet."
            )
          );
        }
        if (isProf && prof.id !== userId) {
          return fallback(
            pick(
              lang,
              "معلومات هذا الأستاذ خاصة بإدارة المركز ولا يمكنني عرضها لك.",
              "Les informations de ce professeur sont réservées à la direction."
            )
          );
        }
        const matched = d.profs.find((p) => p.prof.id === prof.id)!;
        const groupes = await prisma.groupe.findMany({
          where: { centerId, profId: prof.id },
          orderBy: { nom: "asc" },
          select: {
            id: true,
            nom: true,
            matiere: { select: { nom: true } },
            _count: { select: { inscriptions: { where: { statut: "actif" } } } },
          },
        });
        const students = groupes.reduce((s, g) => s + Number(g._count.inscriptions ?? 0), 0);
        const pscope = { centerId, profId: prof.id };
        const [att, fin, ratt] = await Promise.all([
          attendanceCounts(pscope, "month", now),
          getTeacherDashboardFinance(centerId, prof.id),
          rattrapageSeances(pscope, "month", now),
        ]);
        const gNames = groupes.map((g) => `${g.nom}${g.matiere ? ` (${g.matiere.nom})` : ""}`).join("، ") || (lang === "ar" ? "لا يوجد" : "aucun");
        const attPct = att.total > 0 ? `${Math.round((att.present / att.total) * 100)}%` : "—";
        return fallback(
          pick(
            lang,
            `👤 ${matched.prof.prenom} ${matched.prof.nom} — ${mk}\n` +
              `🧩 ${int(groupes.length)} مجموعات (${int(students)} تلميذ): ${gNames}\n` +
              `💵 إيراد الحصص: ${money(matched.netRevenue)} · ربح المركز: ${money(matched.beneficeCentre)} (${matched.taux}%)\n` +
              `💳 قابل للصرف: ${money(fin.claimable)}${fin.impayeNet > 0 ? ` · إجمالي المستحق: ${money(fin.impayeNet)}` : ""}\n` +
              `📋 حضور مجموعاته: ${int(att.present)}/${int(att.total)} (${attPct}) · 🔁 تعويضات: ${int(ratt.length)}`,
            `👤 ${matched.prof.prenom} ${matched.prof.nom} — ${mk}\n` +
              `🧩 ${int(groupes.length)} groupes (${int(students)} élèves) : ${gNames.replace(/،/g, ",")}\n` +
              `💵 Revenu séances : ${money(matched.netRevenue)} · Part centre : ${money(matched.beneficeCentre)} (${matched.taux}%)\n` +
              `💳 À réclamer : ${money(fin.claimable)}${fin.impayeNet > 0 ? ` · Dû : ${money(fin.impayeNet)}` : ""}\n` +
              `📋 Présence de ses groupes : ${int(att.present)}/${int(att.total)} (${attPct}) · 🔁 Rattrapages : ${int(ratt.length)}`
          )
        );
      }

      case "prof_verification": {
        const rows = await profVerificationToday(centerId, now);
        if (rows.length === 0) {
          return fallback(pick(lang, "✅ جميع الأساتذة ثبّتوا حضور حصص اليوم.", "✅ Tous les profs ont pointé leurs séances du jour."));
        }
        const lines = rows
          .slice(0, 8)
          .map((r) => `• ${r.prenom} ${r.nom}: ${int(r.nb)} حصص${r.groupes.length > 0 ? ` (${r.groupes.join("، ")})` : ""}`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `⚠️ أساتذة لم يثبتوا حضورًا اليوم (${int(rows.length)}):\n${lines}`,
            `⚠️ Profs sans pointage aujourd'hui (${int(rows.length)}):\n${lines}`
          )
        );
      }

      // ─────────────────────────── PROF : journée / bilan / dettes ──────────
      case "my_day": {
        const { from: f0, to: t0 } = periodRange("today", now);
        const seances = await prisma.seance.findMany({
          where: {
            date: { gte: f0 ?? undefined, lte: t0 ?? undefined },
            statut: { not: "annulee" },
            groupe: { profId: userId },
          },
          orderBy: [{ heureDebut: "asc" }],
          select: {
            id: true,
            heureDebut: true,
            groupe: { select: { nom: true, matiere: { select: { nom: true } } } },
          },
        });
        if (seances.length === 0) {
          return fallback(pick(lang, "لا توجد حصص لك اليوم. 👌", "Aucune séance pour vous aujourd'hui. 👌"));
        }
        const pc = await presenceCountsBySeance(seances.map((s) => s.id));
        const lines = seances
          .map((s) => {
            const c = pc.get(s.id) ?? { present: 0, absent: 0 };
            const nb = c.present + c.absent;
            const h = s.heureDebut ? s.heureDebut.toISOString().slice(11, 16) : "";
            return `• ${h} — ${s.groupe.nom}${s.groupe.matiere ? ` (${s.groupe.matiere.nom})` : ""} — ${int(nb)} تلميذ · حضور ${int(c.present)} · غياب ${int(c.absent)}`;
          })
          .join("\n");
        return fallback(
          pick(
            lang,
            `🗓️ برنامجك اليوم (${int(seances.length)}):\n${lines}`,
            `🗓️ Votre journée (${int(seances.length)}):\n${lines}`
          )
        );
      }

      case "my_month": {
        const mk = monthKey(now);
        const fin = await getTeacherDashboardFinance(centerId, userId);
        const [ratt, att, seances] = await Promise.all([
          rattrapageSeances(scope, "month", now),
          attendanceCounts(scope, "month", now),
          seancesInRange(scope, "month", now),
        ]);
        const term = seances.filter((s) => s.statut === "terminee").length;
        const plan = seances.filter((s) => s.statut !== "terminee").length;
        return fallback(
          pick(
            lang,
            `📋 ملخصي — ${mk}:\n` +
              `💵 المستحق لك (claimable): ${money(fin.claimable)}${fin.impayeNet > 0 ? ` · إجمالي مستحق: ${money(fin.impayeNet)}` : ""}\n` +
              `📅 حصصك: ${int(term)} منتهية / ${int(plan)} مجدولة في الشهر\n` +
              `🚶 غيابات مجموعاتك: ${int(att.absent)}\n` +
              `🔁 تعويضاتك: ${int(ratt.length)}`,
            `📋 Mon bilan — ${mk}:\n` +
              `💵 À réclamer (claimable) : ${money(fin.claimable)}${fin.impayeNet > 0 ? ` · Total dû : ${money(fin.impayeNet)}` : ""}\n` +
              `📅 Séances : ${int(term)} terminées / ${int(plan)} planifiées\n` +
              `🚶 Absences dans vos groupes : ${int(att.absent)}\n` +
              `🔁 Vos rattrapages : ${int(ratt.length)}`
          )
        );
      }

      case "my_group_debtors": {
        const u = await unpaidRows(centerId, parsed.period === "all" ? "all" : "month", now, userId);
        if (u.rows.length === 0) {
          return fallback(pick(lang, "رائع — لا يوجد مدينون في مجموعاتك. 🎉", "Parfait — aucun débiteur dans vos groupes. 🎉"));
        }
        const lines = u.rows
          .slice(0, 8)
          .map((r, i) => `${i + 1}. ${r.prenom} ${r.nom} — ${money(r.remaining)} (${r.groupeNom})`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `💳 مديونو مجموعاتك (${int(u.count)} — ${money(u.total)}):\n${lines}` +
              (u.rows.length > 8 ? `\n… والبقية (${u.rows.length - 8})` : ""),
            `💳 Débiteurs de vos groupes (${int(u.count)} — ${money(u.total)}):\n${lines}` +
              (u.rows.length > 8 ? `\n… et ${u.rows.length - 8} autres` : "")
          )
        );
      }

      case "admin_only":
        return fallback(
          pick(
            lang,
            "هذه المعلومة خاصة بإدارة المركز. يمكنك أن تسألني عن: برنامجك اليوم، من غاب اليوم، من لم يدفع في مجموعاتك، ملخصك الشهري، تعويضاتك، أو رصيدك المالي.",
            "Cette information est réservée à la direction. Vous pouvez me demander : votre programme du jour, les absences du jour, qui ne paie pas dans vos groupes, votre bilan mensuel, vos rattrapages ou votre solde."
          )
        );

      case "help":
      default: {
        return fallback(pick(lang, ASSISTANT_HELP_AR, ASSISTANT_HELP_FR));
      }
    }
  } catch (err) {
    console.error("[assistant] erreur:", err);
    return fallback(
      pick(
        lang,
        "حدث خطأ أثناء الحساب، حاول مرة أخرى بعد قليل.",
        "Une erreur est survenue pendant le calcul, réessayez dans un instant."
      )
    );
  }
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}