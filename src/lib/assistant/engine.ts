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

  // ── my_finance (prof) ──
  if (has(t, "رصيدي", "مستحقاتي", "ارباحي", "ربحي", "حقوقي", "دوري", "حسابي المالي", "رصيد", "حصتي", "حصتك", "حصة المالية", "ماليتي") ||
      has(fr, "mon solde", "mes gains", "mes droits", "ma compta", "claimable", "mon compte financier", "ma part")) {
    if (isProf) return { kind: "my_finance", period: "month", lang: parsed?.lang ?? detectLang(raw) };
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
    has(fr, "impaye", "impayes", "dette", "debiteur", "debitrice", "recouvrement", "arriere", "pas paye", "sans payer", "doit");
  if (unpaidWord) {
    const isTotal = has(t, "كم", "اجمالي", "المجموع", "مجموع", "قيمة", "المبلغ") || has(fr, "combien", "total");
    return {
      kind: isTotal ? "unpaid_total" : "unpaid_list",
      period: parsed?.period ?? "all",
      lang: parsed?.lang ?? detectLang(raw),
    };
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
      "حصصي هذا الاسبوع",
      "من غاب اليوم؟",
      "تلاميذ مجموعتي",
      "اكثر تلميذ غيابا",
      "تعويضاتي",
    ];
  }
  return [
    "ربح هذا الشهر",
    "من لم يسدد؟",
    "معدل الغياب هذا الشهر",
    "اكثر مجموعة غيابا",
    "حصص اليوم",
    "ربح كل استاذ",
  ];
}

export const ASSISTANT_HELP_AR = `أنا مساعدك الذكي، أساعدك بالأرقام من بياناتك فقط. جرّب:
• ربح هذا الشهر
• مقارنة الربح مع الشهر الماضي
• من لم يسدد؟
• معدل الغياب هذا الشهر
• اكثر مجموعة غيابا
• حصص اليوم
• ربح كل استاذ
• ربح استاذ (بالاسم)
• عدد التلاميذ والاساتذة
• مجموعات مادة (الاسم)
ويمكنك أن تسأل بنفس الصياغة بالفرنسية.`;

export const ASSISTANT_HELP_FR = `Je suis votre assistant, je réponds uniquement avec les chiffres de votre base. Essayez :
• Bénéfice du mois
• Comparer avec le mois dernier
• Qui n'a pas payé ?
• Taux d'absence du mois
• Groupe le plus absent
• Séances du jour
• Gains de chaque professeur
• Gain d'un professeur (par nom)
• Nombre d'élèves et de profs
• Groupes d'une matière (nom)`;