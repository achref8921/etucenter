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

      // ─────────────────────────── IMPAYÉS (admin) ──────────────────────────
      case "unpaid_total": {
        const u = await unpaidRows(centerId, parsed.period, now);
        const periodTxt = parsed.period === "all" ? "" : parsed.period === "month" ? " هذا الشهر" : " هذه الفترة";
        return fallback(
          pick(
            lang,
            `💳 إجمالي المتأخرات${periodTxt}: ${money(u.total)}\n` +
              `عدد المديونين: ${int(u.count)}`,
            `💳 Total impayés${parsed.period === "month" ? " du mois" : ""}: ${money(u.total)}\n` +
              `Débiteurs : ${int(u.count)}`
          )
        );
      }

      case "unpaid_list": {
        const u = await unpaidRows(centerId, parsed.period, now);
        if (u.rows.length === 0) {
          return fallback(pick(lang, "رائع — لا يوجد أي تلميذ متأخر.", "Parfait — aucun impayé."));
        }
        const lines = u.rows
          .slice(0, 8)
          .map((r, i) => `${i + 1}. ${r.prenom} ${r.nom} — ${money(r.remaining)} (${r.groupeNom})`)
          .join("\n");
        return fallback(
          pick(
            lang,
            `🔻 المتأخرون (${int(u.count)}) — إجمالي ${money(u.total)}:\n${lines}` +
              (u.rows.length > 8 ? `\n… والبقية (${u.rows.length - 8})` : ""),
            `🔻 Débiteurs (${int(u.count)}) — total ${money(u.total)}:\n${lines}` +
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