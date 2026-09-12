export type Lang = "ar" | "fr";

export type PeriodKey =
  | "today"
  | "week"
  | "month"
  | "prev_month"
  | "year"
  | "last30"
  | "all";

export type IntentKind =
  | "profit_month"
  | "profit_compare"
  | "profit_ytd"
  | "revenue_by_matiere"
  | "revenue_by_prof"
  | "profit_prof_detail"
  | "unpaid_total"
  | "unpaid_list"
  | "attendance_rate"
  | "absent_today"
  | "most_absent_students"
  | "most_absent_groups"
  | "most_absent_profs"
  | "counts"
  | "seances"
  | "seances_next"
  | "unverified_seances"
  | "rattrapage"
  | "my_rattrapage"
  | "groupes_by_matiere"
  | "group_students"
  | "student_attendance"
  | "my_finance"
  | "my_remaining_seances"
  | "daily_brief"
  | "monthly_brief"
  | "health_score"
  | "collection_rate"
  | "projection"
  | "at_risk_students"
  | "debtors_by_group"
  | "churn_risk"
  | "new_students"
  | "payment_habits"
  | "student_profile"
  | "prof_info"
  | "prof_verification"
  | "my_day"
  | "my_month"
  | "my_group_debtors"
  | "admin_only"
  | "help";

export interface ParsedIntent {
  kind: IntentKind;
  period: PeriodKey;
  lang: Lang;
}

const ARABIC_CHARS = /[\u0600-\u06FF]/;
const TASHKEEL = /[\u064B-\u0652]/g;

const FRENCH_MARKERS = [
  "combien", "mois", "annee", "semaine", "aujourd", "benefice", "revenu",
  "gain", "prof", "profs", "professeur", "professeurs", "eleve", "eleves",
  "etudiant", "groupe", "seance", "seances", "absence", "absences",
  "presence", "presences", "impaye", "impayes", "dette", "debiteur",
  "debitrice", "matiere", "retard", "rattrapage", "salaire", "solde",
  "recouvrement", "top", "liste", "taux", "date", "donne", "existe",
  "session", "cours", "paie", "paye", "total", "reste", "semestre",
  "trimestre", "paiement", "classe", "devoir", "bonjour", "salut",
  "bonsoir", "merci", "comment", "qui",
];

function stripTashkeel(s: string): string {
  return s.replace(TASHKEEL, "");
}

function normalizeAr(s: string): string {
  return stripTashkeel(s)
    .replace(/[أإآ]/g, "ا")
    .replace(/ٱ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLang(raw: string): Lang {
  if (ARABIC_CHARS.test(raw)) return "ar";
  const fr = normalizeFr(raw);
  let score = 0;
  for (const m of FRENCH_MARKERS) if (fr.includes(m)) score++;
  return score > 0 ? "fr" : "ar";
}

function has(t: string, ...keys: string[]): boolean {
  return keys.some((k) => t.includes(k));
}

function anyRaw(raw: string, ...keys: string[]): boolean {
  const fr = normalizeFr(raw);
  return keys.some((k) => fr.includes(k));
}

function hasLikelyName(t: string): boolean {
  const skip = new Set([
    "من", "كم", "اين", "كيف", "هل", "اليوم", "الشهر", "الاسبوع", "هذا", "هذه",
    "نسبة", "معدل", "الكل", "امس", "الان", "الايام", "الحصص", "الحصة", "حصص",
    "مجموعتي", "المجموعة", "المجموعات", "تعويض", "تعويضات", "ربح", "لا", "بال",
    "غاب", "الغائبين", "الغايبين", "الا", "كل", "دون", "بدون", "بلا",
    "استاذ", "الاستاذ", "الاساتذة", "تلميذ", "التلميذ", "التلاميذ", "طالب",
    "الطلاب", "الطالب", "الحضور", "الغياب", "غايب", "عندنا", "عندي", "لكل",
  ]);
  const words = t.split(/\s+/).filter((w) => w.length >= 3 && !skip.has(w));
  return words.length > 0;
}

function detectPeriod(raw: string, fallback: PeriodKey): PeriodKey {
  const t = normalizeAr(raw);
  const fr = normalizeFr(raw);

  if (has(t, "الامس", "امس", "البارح") || has(fr, "hier")) return "today";
  if (has(t, "اليوم", "الان", "الحين") || has(fr, "aujourdhui", "maintenant", "ce soir")) return "today";
  if (has(t, "الشهر الماضي", "الشهر الفايت") || has(fr, "mois dernier", "mois derniere")) return "prev_month";
  if (has(t, "من بداية السنة", "منذ بداية السنة", "هذه السنة", "اول السنة", "بداية السنة") || has(fr, "depuis le debut")) return "year";
  if (has(t, "السنة", "السنه") || has(fr, "annee") && !has(fr, "prochaine")) return "year";
  if (has(t, "الاخيرة", "الاخيره", "الايام الاخيرة", "اخر فترة", "الاخير") || has(fr, "derniere", "derniers", "30")) return "last30";
  if (has(t, "هذا الاسبوع", "الاسبوع", "اسبوع", "هذا الاسبوع") || has(fr, "semaine")) return "week";
  if (has(t, "الشهر", "شهر") || has(fr, "mois", "month")) return "month";
  return fallback;
}

function intentFrom(raw: string, isProf: boolean, parsed: ParsedIntent | null): ParsedIntent {
  const t = normalizeAr(raw);
  const fr = normalizeFr(raw);

  const admin = (kind: IntentKind, profAlt?: IntentKind): ParsedIntent => {
    if (isProf) {
      return {
        kind: profAlt ?? "admin_only",
        period: parsed?.period ?? "month",
        lang: parsed?.lang ?? detectLang(raw),
      };
    }
    return { kind, period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  };

  // ── my_finance (prof) ──
  if (has(t, "رصيدي", "مستحقاتي", "ارباحي", "ربحي", "حقوقي", "دوري", "حسابي المالي", "رصيد", "حصتي", "حصتك", "حصة المالية", "ماليتي") ||
      has(fr, "mon solde", "mes gains", "mes droits", "ma compta", "claimable", "mon compte financier", "ma part")) {
    if (isProf) return { kind: "my_finance", period: "month", lang: parsed?.lang ?? detectLang(raw) };
  }

  // ── plan du jour / bilan du mois (prof) ──
  if (isProf) {
    if (has(t, "خطة اليوم", "خطة يومي", "برنامج اليوم", "برنامج يومي", "جدول اليوم", "ماذا عندي اليوم", "اللي عندي اليوم", "ما عندي اليوم") ||
        has(fr, "mon programme", "mon jour", "ma journee")) {
      return { kind: "my_day", period: "today", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (has(t, "ملخصي", "ملخص الشهر", "وضعي الشهر", "ملخص شهري", "ملخص هذا الشهر", "حسابي مع المادة") ||
        has(fr, "mon resume", "mon rapport", "ma synthese")) {
      return { kind: "my_month", period: "month", lang: parsed?.lang ?? detectLang(raw) };
    }
  }

  // ── briefs (admin) ──
  if (has(t, "ملخص اليوم", "تقريير اليوم", "تقرير اليوم", "برييف", "الوضع اليوم", "حالة اليوم", "نلخصلي اليوم", "نقاط اليوم") ||
      has(fr, "resume du jour", "rapport du jour", "brief du jour", "point du jour", "recap du jour")) {
    return admin("daily_brief", "my_day");
  }
  if (has(t, "ملخص الشهر", "ملخص هذا الشهر", "تقرير الشهر", "ملخص شهري", "تقرير شهري", "الوضع العام", "وضع المركز", "حالة المركز") ||
      has(fr, "resume du mois", "rapport mensuel", "recap", "bilan du mois")) {
    return admin("monthly_brief", "my_month");
  }

  // ── santé du centre / score ──
  if (has(t, "صحة المركز", "مؤشر المركز", "مؤشر صحة", "مؤشر الصحة", "درجة المركز", "نقطة المركز", "نقاط المركز") ||
      has(fr, "sante du centre", "sante", "indicateur", "score", "health")) {
    return admin("health_score");
  }

  // ── impayés de MES groupes (prof) ──
  if (isProf &&
      (has(t, "مجموعتي", "مجموعاتي", "مجموعة", "قروباتي") &&
       (has(t, "لم يدفع", "لم يخلص", "مديون", "مدين", "لم يسدد", "المتاخرات", "متاخرات", "مستخلصاتي", "تحصيل") ||
        has(fr, "qui me doit", "mes debiteurs", "mes impayes", "debiteur", "impaye", "doit", "recouvrement")))) {
    return { kind: "my_group_debtors", period: parsed?.period ?? "all", lang: parsed?.lang ?? detectLang(raw) };
  }

  // ── élèves à risque (admin) ──
  if (has(t, "تلاميذ الخطر", "طلاب الخطر", "الخطر", "اكبر مديونية", "اكثر مديونية", "اكبر المديونيات", "اولويات الدفع", "لازم نخلصهم", "لازم نطالب") ||
      has(fr, "a risque", "dangereux", "plus grosses dettes", "grosse dette", "priorite de paiement")) {
    return admin("at_risk_students", "my_group_debtors");
  }

  // ── recouvrement (admin) ──
  if (has(t, "نسبة التحصيل", "التحصيل", "الاستخلاص", "نسبة الاستخلاص", "كم استخلصنا", "نسبة المدفوع", "نسبة الدفع") ||
      has(fr, "taux de recouvrement", "recouvrement", "encaissement", "taux d encaissement")) {
    return admin("collection_rate");
  }

  // ── impayés par groupe (admin) ──
  if (has(t, "حسب المجموعة", "حسب المجموعات", "لكل مجموعة", "المتاخرات حسب المجموعة", "المدينون حسب المجموعة", "مجموعة اكثر مديونية") ||
      has(fr, "par groupe", "par groupes")) {
    return admin("debtors_by_group", "my_group_debtors");
  }

  // ── prévision / projection (admin) ──
  if (has(t, "توقعات الشهر", "توقع الشهر", "نتتبع الشهر", "كم نتوقع", "توقعات", "متوقع", "الايراد المتوقع", "الايراد المنتظر") ||
      has(fr, "prevision", "previsions", "projection", "forecast", "estimation")) {
    return admin("projection");
  }

  // ── profit d'un prof précis (admin) ──
  const profitWord = has(t, "ربح", "دخل", "ايراد", "اجر", "مرتب", "ارباح") || has(fr, "profit", "revenu", "gain", "salaire", "benefice");
  const profSingular = has(t, "استاذ", "معلم", "الاستاذ", "ستاذ") || has(fr, "prof ", "professeur") && !has(fr, "professeurs", "profs");
  const profPlural = has(t, "الاساتذة", "الاساذة", "اساتذة", "كل استاذ", "كل المعلمين", "جميع الاساتذة") || has(fr, "profs", "professeurs", "chacun des profs");
  const matiereWord = has(t, "مادة", "مواد", "المادة") || has(fr, "matiere");
  const compareWord = has(t, "المقارنة", "مقارنة", "قارن", "الفرق", "بالمقارنة", "عن الشهر الماضي") ||
    has(fr, "comparaison", "comparer", "par rapport", "difference");

  if (profitWord) {
    // le prof ne voit que SON finance
    if (isProf) {
      return { kind: "my_finance", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (profPlural) {
      return { kind: "revenue_by_prof", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (profSingular) {
      return { kind: "profit_prof_detail", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (matiereWord) {
      return { kind: "revenue_by_matiere", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (compareWord) {
      return { kind: "profit_compare", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (parsed?.period === "year") {
      return { kind: "profit_ytd", period: "year", lang: parsed?.lang ?? detectLang(raw) };
    }
    return { kind: "profit_month", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }

  // ── unpaid ──
  const unpaidWord = has(t, "متاخرات", "متأخرات", "متدخل", "مديون", "مدين", "لم يسدد", "لم يدفع", "لم يخلص", "لم يسد") ||
    has(fr, "impaye", "impayes", "dette", "debiteur", "debitrice", "arriere", "pas paye", "sans payer", "doit");
  if (unpaidWord) {
    const isTotal = has(t, "كم", "اجمالي", "المجموع", "مجموع", "قيمة", "المبلغ") || has(fr, "combien", "total");
    return {
      kind: isTotal ? "unpaid_total" : "unpaid_list",
      period: parsed?.period ?? "all",
      lang: parsed?.lang ?? detectLang(raw),
    };
  }

  // ── élèves inactifs / churn (admin) ──
  if (has(t, "لم يحضر منذ", "لم يحضروا", "توقف عن الحضور", "توقفوا عن الحضور", "غير نشطين", "غير نشط", "متوقفين", "منذ فترة", "منذ اسبوع", "منذ ايام", "بلا نشاط", "غير فعالين", "من زمان") ||
      has(fr, "inactif", "inactifs", "ne vient plus", "ne viennent plus", "plus depuis", "abandon")) {
    return admin("churn_risk");
  }

  // ── profil d'un élève ──
  if (has(t, "ملف التلميذ", "ملف الطالب", "ملف المشترك", "بيانات التلميذ", "سيرة التلميذ", "بطاقة التلميذ", "ملف تلميذ", "ملف طالب",
          "معلومات عن التلميذ", "معلومات التلميذ", "معلومات عن الطالب", "تفاصيل التلميذ", "تفاصيل الطالب",
          "من هو التلميذ", "من يكون التلميذ", "شكون التلميذ", "عن التلميذ", "على التلميذ", "وراء التلميذ") ||
      has(fr, "profil de l eleve", "profil eleve", "fiche eleve", "fiche de l eleve", "profil de l etudiant",
          "informations sur l eleve", "info eleve", "details eleve", "qui est l eleve", "parle moi du eleve")) {
    return admin("student_profile");
  }

  // ── nouvelles inscriptions ──
  if (has(t, "المنضمين", "جدد هذا الشهر", "انضموا هذا الشهر", "تسجيلات جديدة", "تلاميذ جدد", "الجدد", "من انضم", "انضم") ||
      has(fr, "nouvelles inscriptions", "nouveaux eleves", "inscrits ce mois", "nouvelles insc")) {
    return admin("new_students");
  }

  // ── habitudes de paiement (admin) ──
  if (has(t, "طرق الدفع", "انواع الدفع", "طريقة الدفع", "كيف يدفعون", "عادات الدفع", "افضل شهر", "اكثر شهر تحصيل") ||
      has(fr, "methodes de paiement", "habitudes de paiement", "comment ils paient", "moyens de paiement")) {
    return admin("payment_habits");
  }

  // ── profs sans pointage aujourd'hui (admin) ──
  if ((has(t, "استاذ", "اساتذة", "المعلم") && has(t, "لم يثبت", "لم يسجلوا", "بلا تصريح", "بلا حضور")) ||
      (has(fr, "prof", "professeurs") && has(fr, "non pointe", "sans pointage", "a verifier", "non verifie"))) {
    return admin("prof_verification");
  }

  // ── informations sur un prof précis (par nom) ──
  if (has(t, "معلومات عن الاستاذ", "معلومات الاستاذ", "معلومات على الاستاذ", "بيانات الاستاذ", "تفاصيل الاستاذ",
          "من هو الاستاذ", "من يكون الاستاذ", "شكون الاستاذ", "خبرني عن الاستاذ", "اوريني الاستاذ",
          "على الاستاذ", "عن الاستاذ") ||
      has(fr, "informations sur le prof", "informations prof", "info prof", "details prof", "fiche prof",
          "profil du prof", "parle moi du prof", "qui est le prof")) {
    return { kind: "prof_info", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }

  // ── attendance / absence ──
  const absenceWord = has(t, "غياب", "غايب", "الغائبين", "غاب") || has(fr, "absence", "absent", "manque");
  const presenceWord = has(t, "حضور", "حضر") || has(fr, "presence", "attendance");
  const rateWord = has(t, "معدل", "نسبة") || has(fr, "taux");

  if (has(t, "غيابي", "غياب مجموعتي") || has(fr, "ma classe")) {
    if (isProf) return { kind: "absent_today", period: "today", lang: parsed?.lang ?? detectLang(raw) };
  }
  if ((absenceWord || presenceWord) && rateWord) {
    return { kind: "attendance_rate", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }
  if (has(t, "اكثر استاذ", "اكثر اساتذة", "اكثر معلم") || has(fr, "top prof", "prof .* plus")) {
    return { kind: "most_absent_profs", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }
  if (has(t, "اكثر مجموعة", "اكثر المجموعات") || has(fr, "top groupe")) {
    return { kind: "most_absent_groups", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }
  if (absenceWord && (has(t, "اليوم", "الان", "اليوم") || has(fr, "aujourdhui"))) {
    return { kind: "absent_today", period: "today", lang: parsed?.lang ?? detectLang(raw) };
  }
  if (has(t, "اكثر تلميذ", "اكثر طالب", "الاكثر غيابا", "اكثر غيابا", "الاكثر غايب", "اكثر غايب") ||
      has(fr, "top eleve", "top student", "plus absent")) {
    return { kind: "most_absent_students", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }
  if (has(t, "بدون حضور", "بلا حضور", "دون حضور", "غير مدونة", "غير مسجل", "بدون تصريح", "حصة منتهية") ||
      has(fr, "sans presence", "non verifiee", "non point", "non verifiee", "a verifier")) {
    return { kind: "unverified_seances", period: "all", lang: parsed?.lang ?? detectLang(raw) };
  }
  if ((has(t, "التلميذ", "الطالب", "تلميذ", "طالب") || has(fr, "eleve", "etudiant", "student") ||
      ((presenceWord || absenceWord) && hasLikelyName(t))) &&
      (presenceWord || absenceWord)) {
    return { kind: "student_attendance", period: parsed?.period ?? "all", lang: parsed?.lang ?? detectLang(raw) };
  }
  if (absenceWord) {
    return { kind: "attendance_rate", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }

  // ── counts ──
  if (has(t, "عدد", "كم عدد", "العدد") || has(fr, "combien", "nombre", "count")) {
    const entity = has(t, "تلاميذ", "طلاب", "تلميذ", "تلامذة", "eleve", "student", "ترميلة") ||
      has(fr, "eleve", "eleves", "student", "etudiant");
    const profs = has(t, "اساتذة", "استاذ", "معلمين") || has(fr, "prof");
    const groups = has(t, "مجموعات", "مجموعة") || has(fr, "groupe");
    if (entity || profs || groups) {
      return { kind: "counts", period: "all", lang: parsed?.lang ?? detectLang(raw) };
    }
  }

  // ── rattrapage ──
  const rattrapageNow = has(t, "تعويضاتي", "تعويضي") || has(fr, "mes rattrapages");
  if (rattrapageNow && isProf) {
    return { kind: "my_rattrapage", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }
  const rattrapageWord = has(t, "تعويض", "تعويضات", "استدراك", "رابطاج") || has(fr, "rattrapage");
  if (rattrapageWord) {
    return { kind: isProf ? "my_rattrapage" : "rattrapage", period: parsed?.period ?? "month", lang: parsed?.lang ?? detectLang(raw) };
  }

  // ── groupes ──
  if (has(t, "مجموعات", "مجموعة") && (matiereWord || has(t, "ماده"))) {
    return { kind: "groupes_by_matiere", period: "all", lang: parsed?.lang ?? detectLang(raw) };
  }
  if (has(t, "تلاميذ", "طلاب", "المسجلين", "من في المجموعة", "طلاب المجموعة", "في مجموعتي", "تلامذة") ||
      has(fr, "liste", "eleves du groupe", "etudiants", "students")) {
    const hasGroupe = has(t, "مجموع", "المجموعة", "مجموعت") || has(fr, "groupe", "classe");
    if (hasGroupe) {
      return { kind: "group_students", period: "all", lang: parsed?.lang ?? detectLang(raw) };
    }
  }

  // ── seances (generique, role-aware) ──
  const seanceWord = has(t, "حصص", "حصصي", "حصة", "حصتي") || has(fr, "seance", "cours", "seances");
  if (seanceWord) {
    if (has(t, "متبقي", "متبقية", "بقى", "باقية", "كم حصة", "ما تبقى") || has(fr, "reste", "remaining", "restantes")) {
      return { kind: "my_remaining_seances", period: "month", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (parsed?.period === "week") {
      return { kind: "seances", period: "week", lang: parsed?.lang ?? detectLang(raw) };
    }
    if (has(t, "الايام القادمة", "الايام المقبلة", "اليومين", "غدا", "الغد") || has(fr, "prochains", "a venir", "demain")) {
      return { kind: "seances_next", period: "month", lang: parsed?.lang ?? detectLang(raw) };
    }
    return { kind: "seances", period: parsed?.period ?? "today", lang: parsed?.lang ?? detectLang(raw) };
  }

  return { kind: "help", period: "all", lang: parsed?.lang ?? detectLang(raw) };
}

export function parseIntent(raw: string, isProf: boolean): ParsedIntent {
  if (!raw || !raw.trim()) {
    return { kind: "help", period: "all", lang: "ar" };
  }
  const period = detectPeriod(raw, "month");
  const lang = detectLang(raw);
  const base: ParsedIntent = { kind: "help", period, lang };
  return intentFrom(raw, isProf, base);
}

export function suggestionChips(isProf: boolean): string[] {
  if (isProf) {
    return [
      "برنامج يومي",
      "من غاب اليوم؟",
      "من لم يدفع في مجموعتي؟",
      "حصصي هذا الاسبوع",
      "ملخصي الشهري",
      "تعويضاتي",
    ];
  }
  return [
    "ملخص اليوم",
    "ربح هذا الشهر",
    "من لم يسدد؟",
    "تلاميذ الخطر",
    "نسبة التحصيل",
    "مؤشر صحة المركز",
    "توقعات الشهر",
  ];
}

export const ASSISTANT_HELP_AR = `أنا مساعدك الذكي — أقدم لك التقرير الجاهز وتنبهك بلا انتظار حساب. جرّب:
• ملخص اليوم / ملخص الشهر (تقرير كامل)
• مؤشر صحة المركز (درجة 0-100)
• نسبة التحصيل هذا الشهر
• تلاميذ الخطر (كبار المديونية)
• المتأخرون حسب المجموعة
• من توقف عن الحضور منذ مدة؟
• من انضم هذا الشهر؟
• طرق الدفع وأفضل شهر تحصيل
• توقعات نهاية الشهر
• ملف تلميذ بالاسم (رصيد، حضور، الحصة القادمة)
• ربح هذا الشهر / مقارنة / كل استاذ / استاذ بالاسم
• دون أي حاضرة؟ حصص اليوم
ويمكنك السؤال بالفرنسية أيضًا.`;

export const ASSISTANT_HELP_FR = `Je suis votre assistant — je vous sors le bilan prêt à lire. Essayez :
• Résumé du jour / du mois (rapport complet)
• Indice de santé du centre (0-100)
• Taux de recouvrement du mois
• Élèves à risque (grosses dettes)
• Impayés par groupe
• Qui ne vient plus ?
• Nouvelles inscriptions du mois
• Méthodes de paiement & meilleur mois
• Prévisions de fin de mois
• Fiche élève (solde, présence, prochaine séance)
• Bénéfice du mois / comparaison / par prof / d'un prof
• Séances du jour, absences, rattrapages
Vous pouvez aussi poser vos questions en arabe.`;