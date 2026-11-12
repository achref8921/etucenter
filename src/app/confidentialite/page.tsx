import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Étudnet",
  description:
    "Comment Étudnet collecte, utilise et protège les données personnelles des centres éducatifs, des professeurs et des élèves.",
};

const CONTACT_EMAIL = "contact@etudnet.app";
const LAST_UPDATE = "12 novembre 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
        {children}
      </div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 dark:from-[#12141a] dark:to-[#0f1116]">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour à la connexion
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9 dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Politique de confidentialité
              </h1>
              <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-500">
                Application Étudnet — dernière mise à jour : {LAST_UPDATE}
              </p>
            </div>
          </div>

          <p className="mt-5 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            Étudnet est une plateforme de gestion destinée aux centres éducatifs
            (écoles, centres de soutien scolaire, instituts de formation). Elle
            permet de gérer les groupes, les séances, les présences, les
            paiements et les documents pédagogiques. La présente politique
            explique quelles données personnelles sont traitées, pourquoi, et
            quels sont vos droits.
          </p>

          <Section title="1. Responsable du traitement">
            <p>
              Les données sont traitées pour le compte du centre éducatif
              utilisateur de la plateforme (ci-après « le Centre »). Le Centre
              décide des données qu'il enregistre et de leurs finalités
              pédagogiques et administratives. Étudnet agit en qualité de
              prestataire technique (sous-traitant).
            </p>
            <p>
              Pour toute question relative à cette politique :{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

          <Section title="2. Données collectées">
            <List
              items={[
                "Données d'identité : nom, prénom, adresse e-mail, numéro de téléphone, date de naissance, niveau, classe et filière.",
                "Identifiants internes : code élève, code professeur, code du centre, rôle (administrateur, professeur, élève).",
                "Photo de profil, uniquement si l'utilisateur choisit d'en ajouter une.",
                "Données pédagogiques : inscriptions aux groupes, séances, présences, documents et supports de cours.",
                "Données financières : montants dus, paiements enregistrés, reçus et soldes.",
                "Messages échangés dans la messagerie interne de la plateforme.",
                "Données techniques : adresse IP, type d'appareil et de navigateur, journaux de connexion et d'erreurs, données d'usage agrégées.",
                "Abonnement aux notifications push, si l'utilisateur l'active.",
              ]}
            />
          </Section>

          <Section title="3. Finalités et bases légales">
            <List
              items={[
                "Fournir le service : authentification, gestion des groupes, séances, présences, paiements et documents (exécution du contrat).",
                "Assurer la communication entre le Centre, les professeurs et les élèves (exécution du contrat).",
                "Sécuriser la plateforme, prévenir les accès non autorisés et corriger les anomalies (intérêt légitime).",
                "Produire des statistiques d'usage agrégées et anonymisées pour améliorer le service (intérêt légitime).",
                "Envoyer des notifications push ou par e-mail, lorsque l'utilisateur y a consenti (consentement, révocable à tout moment).",
              ]}
            />
          </Section>

          <Section title="4. Destinataires des données">
            <p>
              Les données sont accessibles aux personnes habilitées du Centre
              selon leur rôle : les administrateurs accèdent aux données de leur
              centre, les professeurs aux données des groupes et élèves dont ils
              ont la charge, et chaque élève à ses propres données.
            </p>
            <p>
              Étudnet ne vend ni ne loue aucune donnée personnelle. Le recours à
              des prestataires techniques se limite à ce qui est nécessaire au
              fonctionnement du service : hébergement de l'application, base de
              données, stockage sécurisé des documents et envoi des e-mails.
            </p>
          </Section>

          <Section title="5. Hébergement et transferts">
            <p>
              L'application et la base de données sont hébergées par des
              prestataires situés hors de l'Union européenne (États-Unis). Ces
              transferts sont encadrés par les engagements contractuels de ces
              prestataires en matière de protection des données.
            </p>
          </Section>

          <Section title="6. Durée de conservation">
            <p>
              Les données sont conservées pendant la durée de la relation avec le
              Centre, puis archivées ou supprimées conformément aux obligations
              légales (notamment comptables). Les journaux techniques sont
              conservés pour une durée limitée.
            </p>
          </Section>

          <Section title="7. Sécurité">
            <List
              items={[
                "Chiffrement des échanges via HTTPS.",
                "Mots de passe stockés sous forme hachée, jamais en clair.",
                "Cloisonnement des données par centre et contrôle d'accès par rôle.",
                "Documents pédagogiques stockés dans un espace privé, accessibles uniquement par lien signé temporaire.",
                "Journalisation des actions sensibles et sauvegardes régulières.",
              ]}
            />
          </Section>

          <Section title="8. Mineurs">
            <p>
              La plateforme est utilisée par des centres éducatifs et peut
              contenir des données d'élèves mineurs. Ces données sont
              enregistrées par le Centre, sous sa responsabilité, avec
              l'information des parents ou tuteurs légaux. Aucune donnée n'est
              utilisée à des fins publicitaires.
            </p>
          </Section>

          <Section title="9. Cookies et stockage local">
            <p>
              Étudnet utilise uniquement des cookies strictement nécessaires au
              fonctionnement (cookie de session sécurisé) et un stockage local
              pour le fonctionnement hors ligne de l'application. Aucun cookie
              publicitaire ni traceur tiers n'est utilisé.
            </p>
          </Section>

          <Section title="10. Vos droits">
            <p>
              Conformément à la réglementation applicable, vous disposez d'un
              droit d'accès, de rectification, d'effacement, de limitation,
              d'opposition et de portabilité de vos données. Ces demandes
              peuvent être adressées au Centre dont vous dépendez ou à{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {CONTACT_EMAIL}
              </a>
              . Une réponse est apportée dans un délai maximal de 30 jours.
            </p>
          </Section>

          <Section title="11. Suppression du compte et des données">
            <p>
              La suppression d'un compte peut être demandée à tout moment par
              e-mail à{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              ou auprès de l'administrateur du Centre. Le compte est désactivé,
              puis les données personnelles associées sont supprimées ou
              anonymisées, à l'exception de celles dont la conservation est
              imposée par la loi (pièces comptables).
            </p>
          </Section>

          <Section title="12. Modifications">
            <p>
              Cette politique peut être mise à jour pour refléter une évolution
              du service ou de la réglementation. La date de dernière mise à
              jour figure en haut de cette page.
            </p>
          </Section>

          <p className="mt-9 border-t border-slate-200 pt-5 text-[12px] text-slate-400 dark:border-[#2a2d35] dark:text-slate-500">
            Étudnet — plateforme éducative. Contact :{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
