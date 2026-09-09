# PRD — EtuCenter (Platforme de Gestion de Centre de Tutorat)

> **Version:** 1.1.0
> **Date:** 2026-09-06
> **Statut:** Approuvé — base pour la génération des tests (TestSprint / outil de test)
> **Repository:** `achref8921/etucenter` — Live: `https://etucenter-pkhf.vercel.app`

---

## 1. Vue d'ensemble

EtuCenter est une plateforme SaaS multi-tenant (multi-centres) qui permet à un centre de
tutorat/formation de gérer : les utilisateurs (professeurs, élèves, admins), les matières,
les groupes, les inscriptions, les séances, les présences, les paiements, la finance des
élèves (soldes/crédits prépayés), la finance des professeurs (bénéfices, salaires,
payouts), les statistiques, les notifications, et la sauvegarde/restauration de la base.

Elle distingue 4 rôles : `super_admin`, `admin` (directeur du centre), `prof`
(professeur) et `eleve` (élève/étudiant).

---

## 2. Objectifs & critères de succès

| Objectif | Critère |
|---|---|
| Fiabilité de la facturation | Le montant dû / l'impayé doit TOUJOURS être cohérent entre le dû calculé et le grand-livre (compte) élève |
| Réactivité de la comptabilité | La consommation de cours est déduite immédiatement (pas d'attente de statut `terminee`) |
| Simplification forfait | Un élève en forfait doit être facturé au prix forfaitaire (montant ÷ séances) sur TOUTES ses séances, sans condition de date |
| Isolation des centres | Aucun croisement de données entre centres |
| Auditabilité | Chaque opération financière est journalisée (SystemLog) et réversible |

---

## 3. Personas & permissions

| Capabilité | super_admin | admin | prof | eleve |
|---|:--:|:--:|:--:|:--:|
| Gérer les centres (CRUD, statut, abonnements) | ✅ | ❌ | ❌ | ❌ |
| Réglages plateforme, monitoring, backups globaux | ✅ | ❌ | ❌ | ❌ |
| Gérer les utilisateurs du centre (prof/eleve) | ✅ | ✅ | ❌ | ❌ |
| Gérer matières / groupes / inscriptions | ✅ | ✅ | ✅ (ses groupes) | ❌ |
| Créer/modifier séances + présences | ✅ | ✅ | ✅ (ses groupes) | ❌ |
| Créer une « Séance passée » (rattrapage) | ✅ | ✅ | ✅ | ❌ |
| Enregistrer des paiements / factures | ✅ | ✅ | ❌ | ❌ |
| Finances élèves (soldes, ajustements, reçus) | ✅ | ✅ | ❌ | lecture |
| Finances professeurs (taux, payouts) | ✅ | ✅ | lecture (son compte) | ❌ |
| Statistiques & analytics | ✅ | ✅ | ✅ (ses stats) | ❌ |
| Backup / Restore de la base | ✅ | ✅ | ❌ | ❌ |
| Voir son profil / ses paiements / son compte | ✅ | ✅ | ✅ | ✅ |

---

## 4. Fonctionnalités — exigences testables

### 4.1 Authentification & comptes
- **FR-01** (P1) Connexion par email + mot de passe (NextAuth Credentials, session JWT).
  - AC : email inconnu → message d'erreur générique ; mauvais mot de passe → erreur ; succès → redirection selon rôle (`/admin`, `/prof`, `/eleve`).
- **FR-02** (P1) Enregistrement d'un centre (inscription initiale) avec vérification d'email.
  - AC : email en double → 409 ; lien de vérification valide → `actif = true` ; expiré/invalide → erreur.
- **FR-03** (P1) Mot de passe oublié / réinitialisation.
  - AC : token valide (≤ 1h) réinitialise ; token expiré → refus.
- **FR-04** (P1) Centre suspendu/inactif bloque toute connexion (page `/centre-suspendu`).
- **FR-05** (P2) RBAC : chaque API vérifie le rôle + le `centerId` côté serveur.

### 4.2 Multi-tenant & super-admin
- **FR-06** (P1) CRUD des centres : slug unique, code unique, `active` booléen.
- **FR-07** (P1) Abonnements : statut `active/expired/cancelled`, notification à expiration.
- **FR-08** (P2) Monitoring (server, db, ressources) + journal des erreurs.

### 4.3 Utilisateurs du centre
- **FR-09** (P1) CRUD profs/élèves ; suppression logicielle (`deletedAt`), suppression définitive réservée au super-admin.
- **FR-10** (P1) Codes court : `codeEleve` (4) et `codeProf` (5) uniques par centre — utilisés pour le rapprochement de compte.
- **FR-11** (P1) Profil élève : niveau scolaire, classe, filière, date de naissance.
- **FR-12** (P2) Drapeau `peutGererEleves` pour un admin assistant.

### 4.4 Matières & Groupes
- **FR-13** (P1) CRUD matières, nom unique par centre.
- **FR-14** (P1) CRUD groupes : `profId`, `matiereId`, `prixParSeance` (défaut par séance), `capaciteMax`.
- **FR-15** (P1) **Forfait groupe** : saisie « montant + nombre de séances » → `effectivePrixParSeance = montant ÷ séances` stocké dans `groupe.prixParSeance` ; ou « prix fixe par séance ». Les deux champs forfait sont requis ensemble (validation Zod).
  - AC : montant 110 pour 5 séances → prix par séance résultant = 22.00 ; section « Tarif du groupe (défaut) » affiche « 110 DT / 5 séances ».
- **FR-16** (P1) Vérification capacité maximale avant inscription (si renseignée).

### 4.5 Inscriptions & forfait élève
- **FR-17** (P1) Inscription d'un élève dans un groupe, `statut: actif/inactif`, unique `(eleveId, groupeId)`.
- **FR-18** (P1) **Forfait élève (par inscription)** : `forfaitMontant` + `forfaitSeances` + `forfaitSetAt` (horodatage). Défini/édité depuis le dossier élève ou la page du groupe.
  - AC : un forfait actif remplace le prix du groupe pour CE élève ; la suppression du forfait rétablit le prix du groupe.
- **FR-19** (P1) Soft-désinscription (statut `inactif`) sans supprimer l'historique.

### 4.6 Séances
- **FR-20** (P1) CRUD séances (groupe, date, heureDebut, heureFin, statut, notes, `prixParSeance` optionnel pour surcharge).
- **FR-21** (P1) Cycle de statut : `planifiee → en_cours → terminee` (finalisation auto : jours passés → `terminee`, aujourd'hui passé `heureFin` → `terminee`) ; `annulee` manuel.
  - AC : après finalisation, les présences « présents » d'une séance `terminee` restent comptées comme aujourd'hui (aucun changement de montant dû).
- **FR-22** (P1) **Séance passée (rattrapage)** : une ou plusieurs séances créées en `terminee`, présence `present` posée d'office, consommation immédiate au prix effectif de l'élève.
  - AC : pas de doublon (élève + groupe + date) → 409 ; notification + push envoyées avec le montant facturé réel.
- **FR-23** (P2) Surcharge `prixParSeance` par séance conservée pour les élèves HORS forfait.

### 4.7 Présences
- **FR-24** (P1) Enregistrement des présences (`present`/`absent`) par le prof/admin ; unique `(seanceId, eleveId)`.
- **FR-25** (P1) **Fenêtre de modification** : du jour de la séance jusqu'à 7 jours après (`canModifyAttendance`). Hors fenêtre → refus.
- **FR-26** (P1) **Facturation immédiate** : sauvegarder `present` crée immédiatement une `COURSE_CONSUMPTION` (− prix effectif) au compte de l'élève, pour toute séance non `annulee` (y compris `planifiee/en_cours/terminee`).
  - AC : le solde/le dû change dans l'instant, sans attendre `terminee`.
- **FR-27** (P1) **Inversion present → absent** : la consommation est automatiquement annulée (REVERSAL) et le montant est retiré du dû immédiatement.
  - AC : dû = 0 après le basculement.
- **FR-28** (P2) Édition : `enregistrePar`, `dateModification` tracés.

### 4.8 Paiements
- **FR-29** (P1) Paiement partiel ou total (montant > 0), méthodes `especes/virement/cheque/autre`.
- **FR-30** (P1) « Dû / Impayé » = `MAX(0, sum(prix effectif des présents sur séances non annulées) − sum(paiements))`, recalculé en temps réel et identique dans TOUTES les vues (admin, prof, élève, dashboard, analytics).
- **FR-31** (P1) Facture / reçu (`/api/paiements/[id]/facture`) générable après paiement.

### 4.9 Finance élève (grand-livre / compte)
- **FR-32** (P1) Types : `PREPAYMENT` (crédit, reçu numéroté RC-AAAA-NNNN), `COURSE_CONSUMPTION` (débit), `ADJUSTMENT` (débit/crédit manuel), `REVERSAL` (contre-passation d'une consommation).
- **FR-33** (P1) Solde net = somme des `signedAmount` des transactions `active`.
- **FR-34** (P1) Unique `(eleveId, attendanceId)` — une consommation par présence, idempotence (concurrence P2002 gérée).
- **FR-35** (P1) **Re-pricing auto** : si le prix effectif change (ex. forfait posé ensuite, modifié, retiré), la consommation existante est recalculée à la prochaine sauvegarde de la présence (`finance.student.consume.reprice` journalisé).
- **FR-36** (P1) Annulation manuelle d'un prépaiement/ajustement → contre-passation + reçu d'annulation.

### 4.10 Finance professeur
- **FR-37** (P1) `TauxBenefice` (part du centre, défaut global) par prof.
- **FR-38** (P1) Chaque présence payée génère un `EARNING` (montant = prix effectif), `PAYMENT` = payout au prof, `ADJUSTMENT`, `REVERSAL` ; reçus numérotés.
- **FR-39** (P2) Tableau de bord bénéfices : revenu net, part centre, salaire prof, montant réclamable.

### 4.11 Statistiques & dashboards
- **FR-40** (P1) Admin : TCA (revenu), impayés totaux, élèves/profs, séances `terminee`, top absences, top matières par revenu, revenus mensuels.
- **FR-41** (P2) Prof : taux d'absentéisme, présence, son finance.
- **FR-42** (P2) Élève : résumé séances/présences/dû.

### 4.12 Notifications & push
- **FR-43** (P2) Notifications en base + push web (abonnements VAPID). Marquer lu.

### 4.13 Sauvegarde & monitoring
- **FR-44** (P1) Backup manuel/auto versionné avec checksum, statuts `en_cours/ok/echec/restaure`, restauration transactionnelle.
- **FR-45** (P2) Journaux `SystemLog` (audit) consultables.

---

## 5. Moteur de prix — règles métier (critiques pour les tests)

| Réf | Règle |
|---|---|
| **BR-1** | Prix effectif d'une présence = Si inscription active ET `forfaitMontant`/`forfaitSeances` valides (>0) → `montant / séances` ; SINON `seance.prixParSeance` (surcharge) ; SINON `groupe.prixParSeance`. **Sans condition de date** (le `forfaitSetAt` n'est informatif que pour l'affichage). |
| **BR-2** | Le forfait élève est prioritaire sur le forfait/prix du groupe et sur la surcharge de séance. |
| **BR-3** | La consommation est IMMÉDIATE (présence `present`, séance non `annulee`) et inversée à la bascule present→absent. |
| **BR-4** | Dû/Impayé : ne compte que les présences `present` sur les séances dont `statut != 'annulee'` (pas d'attente `terminee`). |
| **BR-5** | Fenêtre d'édition des présences : du jour de séance à +7 jours. |
| **BR-6** | Une « Séance passée » est créée `terminee` + consommation immédiate au prix effectif de chaque élève. |
| **BR-7** | Paiements uniquement positifs ; remboursement via contre-passation (jamais montant négatif). |
| **BR-8** | Toute écriture financière est journalisée dans `SystemLog` (action `finance.*`) et réversible une fois. |

---

## 6. Dictionnaire de données (enums)

- `Role`: super_admin, admin, prof, eleve
- `PresenceStatut`: present, absent
- `SeanceStatut`: planifiee, en_cours, terminee, annulee
- `InscriptionStatut`: actif, inactif
- `MethodePaiement`: especes, virement, cheque, autre
- `StudentTransactionType`: PREPAYMENT, COURSE_CONSUMPTION, ADJUSTMENT, REVERSAL
- `TeacherTransactionType`: EARNING, PAYMENT, ADJUSTMENT, REVERSAL
- `NiveauScolaire`: primaire, college, lycee
- `Filiere`: lettres, economique, informatique, technique, sciences, math
- `BackupStatus`: en_cours, ok, echec, restaure
- `MonitorStatus`: ok, warning, error
- `SubscriptionStatus`: active, expired, cancelled

---

## 7. Non-fonctionnel

- **NFR-1** Temps de réponse api < 500 ms (grand-livre, dashboards indexés).
- **NFR-2** Isolation stricte par `centerId` sur toutes les requêtes (aucune fuite inter-centre).
- **NFR-3** Mots de passe hachés ; tokens de reset/verification à expiration courte.
- **NFR-4** Idempotence des écritures financières (contraintes uniques, gestion P2002).
- **NFR-5** Backups avec checksum ; restauration atomique.
- **NFR-6** PWA : manifest, notifications push, cache mis à jour (hard refresh après chaque déploiement).

---

## 8. Scénarios de test prioritaires (suggestions)

1. **TS-1 Forfait détecté** : élève en forfait 110/5 + séance normale le jour même → dû/consommation = 22,00 (pas le prix du groupe).
2. **TS-2 Rattrapage forfait** : forfait posé PUIS « Séance passée » → facturé au prix forfaitaire (régression #1 corrigée).
3. **TS-3 Rutrapage non-forfait** : élève sans forfait → facturé au prix du groupe.
4. **TS-4 Immédiateté** : présence `present` sur séance `planifiee`/`terminee` → consommation immédiate ; bascule absent → annulation immédiate, dû = 0.
5. **TS-5 Cohérence dû/impayé** : mêmes montants dans admin/groupes/[id], admin/eleves, prof/eleves, eleve/paiements, analytics, dashboard.
6. **TS-6 Re-pricing** : forfait posé après une consommation → re-sauvegarde de la présence → montant corrigé (12,5 → 7,5).
7. **TS-7 Forfait groupe** : 110/5 → prix 22,00 ; suppression du forfait groupe → prix manuel conservé.
8. **TS-8 Fenêtre de modification** : édition refusée au-delà de 7 jours.
9. **TS-9 RBAC** : prof ne peut voir/modifier que ses groupes ; eleve ne peut voir que son propre dossier.
10. **TS-10 Isolation centre** : données centre A invisibles au centre B.

---

## 9. Environnement de test

| Élément | Valeur |
|---|---|
| Runtime | Node 22.23.1 (TypeScript) |
| Framework | Next.js 16 (App Router, Turbopack) |
| DB | PostgreSQL (local `gestion_centre` / prod Neon `neondb`) |
| Auth | NextAuth v4 (JWT) |
| Commandes | `tsc --noEmit`, `next build`, `prisma generate / db push` |
| Live | https://etucenter-pkhf.vercel.app |

---

## 10. Journal des changements

| Version | Date | Changement |
|---|---|---|
| 1.0.0 | 2026-07-24 | Document initial (PROJECT_MAP.md) |
| 1.1.0 | 2026-09-06 | Ajout : forfait groupe + forfait élève, facturation immédiate, re-pricing, séance passée, grand-livre financier, multi-tenant, backups |