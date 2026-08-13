const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is required (set it in the environment or a local .env).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  console.log("Connecting...");
  await prisma.$connect();
  console.log("Connected!\n");

  const password = process.env.SEED_PASSWORD || "123456";
  const hash = await bcrypt.hash(password, 10);

  // ─── Super Admin ───────────────────────────────────────────────
  const defaultCenter = await prisma.center.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Centre Par Défaut", slug: "default", active: true },
  });

  await prisma.utilisateur.upsert({
    where: { email: "superadmin@test.com" },
    update: {},
    create: {
      centerId: defaultCenter.id,
      nom: "Admin", prenom: "Super",
      email: "superadmin@test.com", motDePasse: hash,
      role: "super_admin", actif: true,
    },
  });
  console.log("✅ Super Admin: superadmin@test.com");

  // ─── 3 Centers ────────────────────────────────────────────────
  const centersData = [
    { name: "Centre Ghodhbeni", slug: "centre-ghodhbeni", phone: "+216 71 111 111", address: "Ghodhbeni, Tunis" },
    { name: "Centre El Fath", slug: "centre-el-fath", phone: "+216 71 222 222", address: "El Fath, Ariana" },
    { name: "Centre Ennour", slug: "centre-ennour", phone: "+216 71 333 333", address: "Ennour, Ben Arous" },
  ];

  const centers = [];
  for (const c of centersData) {
    const center = await prisma.center.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, active: true },
    });
    centers.push(center);
    console.log("✅ Center:", center.name);
  }

  // ─── Admins (1 per center) ────────────────────────────────────
  const adminsData = [
    { email: "admin@ghodhbeni.com", nom: "Ben Ahmed", prenom: "Ali", centerIdx: 0 },
    { email: "admin@centre-el-fath.com", nom: "Cherif", prenom: "Walid", centerIdx: 1 },
    { email: "admin@centre-ennour.com", nom: "Bouazizi", prenom: "Hassen", centerIdx: 2 },
  ];

  for (const a of adminsData) {
    await prisma.utilisateur.upsert({
      where: { email: a.email },
      update: {},
      create: {
        centerId: centers[a.centerIdx].id,
        nom: a.nom, prenom: a.prenom,
        email: a.email, motDePasse: hash,
        role: "admin", actif: true,
      },
    });
    console.log("✅ Admin:", a.email);
  }

  // ─── Professors (3 per center) ────────────────────────────────
  const profsData = [
    { email: "enseignant@ghodhbeni.com", nom: "Gharbi", prenom: "Tarek", centerIdx: 0 },
    { email: "sami.enseignant@ghodhbeni.com", nom: "Trabelsi", prenom: "Sami", centerIdx: 0 },
    { email: "fatma.enseignante@ghodhbeni.com", nom: "Mansour", prenom: "Fatma", centerIdx: 0 },
    { email: "enseignant@centre-el-fath.com", nom: "Rejeb", prenom: "Nabil", centerIdx: 1 },
    { email: "sami.enseignant@centre-el-fath.com", nom: "Dridi", prenom: "Sami", centerIdx: 1 },
    { email: "fatma.enseignante@centre-el-fath.com", nom: "Khelifi", prenom: "Fatma", centerIdx: 1 },
    { email: "enseignant@centre-ennour.com", nom: "Jaziri", prenom: "Mehdi", centerIdx: 2 },
    { email: "sami.enseignant@centre-ennour.com", nom: "Ferchichi", prenom: "Sami", centerIdx: 2 },
    { email: "fatma.enseignante@centre-ennour.com", nom: "Selmi", prenom: "Fatma", centerIdx: 2 },
  ];

  const createdProfs = {};
  for (const p of profsData) {
    const prof = await prisma.utilisateur.upsert({
      where: { email: p.email },
      update: {},
      create: {
        centerId: centers[p.centerIdx].id,
        nom: p.nom, prenom: p.prenom,
        email: p.email, motDePasse: hash,
        role: "prof", actif: true,
      },
    });
    if (!createdProfs[p.centerIdx]) createdProfs[p.centerIdx] = [];
    createdProfs[p.centerIdx].push(prof);
    console.log("✅ Prof:", p.email);
  }

  // ─── Students (5+ per center) ─────────────────────────────────
  const studentsData = [
    { email: "mohamed.eleve@ghodhbeni.com", nom: "Ben Ahmed", prenom: "Mohamed", centre: 0, niveau: "lycee", classe: "2ème" },
    { email: "amira.eleve@ghodhbeni.com", nom: "Ben Ahmed", prenom: "Amira", centre: 0, niveau: "lycee", classe: "3ème" },
    { email: "youssef.eleve@ghodhbeni.com", nom: "Mansour", prenom: "Youssef", centre: 0, niveau: "primaire", classe: "5ème Année" },
    { email: "ines.eleve@ghodhbeni.com", nom: "Jaziri", prenom: "Ines", centre: 0, niveau: "college", classe: "7ème" },
    { email: "omar.eleve@ghodhbeni.com", nom: "Cherif", prenom: "Omar", centre: 0, niveau: "lycee", classe: "2ème" },
    { email: "rim.eleve@ghodhbeni.com", nom: "Selmi", prenom: "Rim", centre: 0, niveau: "college", classe: "8ème" },

    { email: "mohamed.eleve@centre-el-fath.com", nom: "Dridi", prenom: "Mohamed", centre: 1, niveau: "lycee", classe: "2ème" },
    { email: "amira.eleve@centre-el-fath.com", nom: "Bouazizi", prenom: "Amira", centre: 1, niveau: "lycee", classe: "3ème" },
    { email: "youssef.eleve@centre-el-fath.com", nom: "Khelifi", prenom: "Youssef", centre: 1, niveau: "primaire", classe: "5ème Année" },
    { email: "ines.eleve@centre-el-fath.com", nom: "Baccar", prenom: "Ines", centre: 1, niveau: "college", classe: "7ème" },
    { email: "omar.eleve@centre-el-fath.com", nom: "Ferchichi", prenom: "Omar", centre: 1, niveau: "lycee", classe: "2ème" },
    { email: "nour.eleve@centre-el-fath.com", nom: "Rejeb", prenom: "Nour", centre: 1, niveau: "college", classe: "6ème" },

    { email: "mohamed.eleve@centre-ennour.com", nom: "Trabelsi", prenom: "Mohamed", centre: 2, niveau: "lycee", classe: "2ème" },
    { email: "amira.eleve@centre-ennour.com", nom: "Gharbi", prenom: "Amira", centre: 2, niveau: "lycee", classe: "3ème" },
    { email: "youssef.eleve@centre-ennour.com", nom: "Mansour", prenom: "Youssef", centre: 2, niveau: "primaire", classe: "4ème Année" },
    { email: "ines.eleve@centre-ennour.com", nom: "Ali", prenom: "Ines", centre: 2, niveau: "college", classe: "7ème" },
    { email: "omar.eleve@centre-ennour.com", nom: "Ben Ahmed", prenom: "Omar", centre: 2, niveau: "lycee", classe: "2ème" },
    { email: "hanen.eleve@centre-ennour.com", nom: "Cherif", prenom: "Hanen", centre: 2, niveau: "college", classe: "8ème" },
  ];

  const createdStudents = {};
  let codeIdx = 1;
  for (const s of studentsData) {
    const codeEleve = `E${String(codeIdx).padStart(3, "0")}`;
    const eleve = await prisma.utilisateur.upsert({
      where: { email: s.email },
      update: {},
      create: {
        centerId: centers[s.centre].id,
        nom: s.nom, prenom: s.prenom,
        email: s.email, motDePasse: hash,
        role: "eleve", actif: true,
        codeEleve, niveau: s.niveau, classe: s.classe,
      },
    });
    if (!createdStudents[s.centre]) createdStudents[s.centre] = [];
    createdStudents[s.centre].push(eleve);
    codeIdx++;
    console.log("✅ Eleve:", s.email, codeEleve);
  }

  // ─── Subjects per center ──────────────────────────────────────
  const matiereNames = ["Mathématiques", "Physique", "Arabe", "Français", "Anglais"];
  const createdMatieres = {};
  for (let ci = 0; ci < 3; ci++) {
    createdMatieres[ci] = [];
    for (const m of matiereNames) {
      const mat = await prisma.matiere.create({
        data: { centerId: centers[ci].id, nom: m },
      });
      createdMatieres[ci].push(mat);
    }
    console.log(`✅ Matières center ${ci}: ${matiereNames.join(", ")}`);
  }

  // ─── Groups per center ────────────────────────────────────────
  const groupesConfig = [
    { nom: "Mathématiques - Groupe A", profIdx: 0, matIdx: 0, prix: 80 },
    { nom: "Physique - Groupe A", profIdx: 1, matIdx: 1, prix: 85 },
    { nom: "Arabe - Groupe A", profIdx: 2, matIdx: 2, prix: 55 },
    { nom: "Français - Groupe A", profIdx: 0, matIdx: 3, prix: 75 },
    { nom: "Anglais - Groupe A", profIdx: 1, matIdx: 4, prix: 50 },
  ];

  const createdGroupes = {};
  for (let ci = 0; ci < 3; ci++) {
    createdGroupes[ci] = [];
    for (const g of groupesConfig) {
      const grp = await prisma.groupe.create({
        data: {
          centerId: centers[ci].id,
          nom: g.nom,
          profId: createdProfs[ci][g.profIdx].id,
          matiereId: createdMatieres[ci][g.matIdx].id,
          prixParSeance: g.prix,
        },
      });
      createdGroupes[ci].push(grp);
    }
    console.log(`✅ Groupes center ${ci}: ${groupesConfig.length} groupes`);
  }

  // ─── Enrollments per center ───────────────────────────────────
  const enrollPatterns = [
    [0, 0], [1, 0], [2, 1], [3, 2], [4, 3], [5, 4],
    [0, 1], [1, 2], [2, 3], [3, 4],
  ];

  let enrollCount = 0;
  for (let ci = 0; ci < 3; ci++) {
    const studs = createdStudents[ci];
    const grps = createdGroupes[ci];
    for (const [si, gi] of enrollPatterns) {
      if (si < studs.length && gi < grps.length) {
        await prisma.inscription.create({
          data: { eleveId: studs[si].id, groupeId: grps[gi].id },
        });
        enrollCount++;
      }
    }
  }
  console.log(`✅ Inscriptions: ${enrollCount}`);

  // ─── Sessions (12 per group) ──────────────────────────────────
  const today = new Date();
  let seanceCount = 0;
  for (let ci = 0; ci < 3; ci++) {
    for (const grp of createdGroupes[ci]) {
      let dayOffset = 0;
      for (let s = 0; s < 12; s++) {
        const d = new Date(today);
        do {
          d.setDate(d.getDate() - dayOffset);
          dayOffset++;
        } while (d.getDay() === 0 || d.getDay() === 6);

        await prisma.seance.create({
          data: {
            groupeId: grp.id,
            date: d,
            statut: "terminee",
            notes: `Séance ${s + 1}`,
          },
        });
        seanceCount++;
      }
    }
  }
  console.log(`✅ Séances: ${seanceCount}`);

  // ─── Presences ────────────────────────────────────────────────
  const allSeances = await prisma.seance.findMany();
  const allInscriptions = await prisma.inscription.findMany();
  let presCount = 0;
  for (const seance of allSeances) {
    const gi = allInscriptions.filter(i => i.groupeId === seance.groupeId);
    for (const ins of gi) {
      try {
        await prisma.presence.create({
          data: {
            seanceId: seance.id,
            eleveId: ins.eleveId,
            statut: Math.random() > 0.15 ? "present" : "absent",
          },
        });
        presCount++;
      } catch {}
    }
  }
  console.log(`✅ Présences: ${presCount}`);

  // ─── Payments ─────────────────────────────────────────────────
  let payCount = 0;
  for (let ci = 0; ci < 3; ci++) {
    for (const grp of createdGroupes[ci]) {
      const gi = allInscriptions.filter(i => i.groupeId === grp.id);
      for (const ins of gi) {
        for (let m = 0; m < 4; m++) {
          if (Math.random() > 0.1) {
            const d = new Date(today);
            d.setMonth(d.getMonth() - m);
            try {
              await prisma.paiement.create({
                data: {
                  eleveId: ins.eleveId,
                  groupeId: grp.id,
                  montant: Number(grp.prixParSeance),
                  methodePaiement: Math.random() > 0.5 ? "especes" : "virement",
                  datePaiement: d,
                },
              });
              payCount++;
            } catch {}
          }
        }
      }
    }
  }
  console.log(`✅ Paiements: ${payCount}`);

  console.log("\n🎉 ─── SEED TERMINÉ ───────────────────────────");
  console.log("📧 Super Admin: superadmin@test.com");
  console.log("📧 Admins: admin@ghodhbeni.com, admin@centre-el-fath.com, admin@centre-ennour.com");
  console.log("📧 Profs: enseignant@*.com, sami.enseignant@*.com, fatma.enseignante@*.com");
  console.log("📧 Eleves: mohamed.eleve@*.com, amira.eleve@*.com, youssef.eleve@*.com, ines.eleve@*.com, omar.eleve@*.com");
  if (!process.env.SEED_PASSWORD) {
    console.log("⚠️  Mot de passe par défaut (123456) utilisé — définissez SEED_PASSWORD pour en choisir un autre.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("ERROR:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
