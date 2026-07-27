import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL LOG] To: ${to}\nSubject: ${subject}\n${html}\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("[EMAIL ERROR]", error);
    return false;
  }
}

export function passwordResetEmail(name: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Réinitialisation de votre mot de passe - GestExam",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #4f46e5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 20px;">GestExam</h1>
        </div>
        <h2 style="color: #1e293b; font-size: 18px;">Bonjour ${name},</h2>
        <p style="color: #475569; line-height: 1.6;">
          Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Réinitialiser le mot de passe
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; text-align: center;">
          Ce lien est valable pendant 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          GestExam - Centre de gestion scolaire
        </p>
      </div>
    `,
  };
}

export function emailVerificationEmail(name: string, verifyUrl: string): { subject: string; html: string } {
  return {
    subject: "Vérifiez votre adresse email - GestExam",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #4f46e5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 20px;">GestExam</h1>
        </div>
        <h2 style="color: #1e293b; font-size: 18px;">Bonjour ${name},</h2>
        <p style="color: #475569; line-height: 1.6;">
          Bienvenue sur GestExam ! Veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Vérifier mon email
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px; text-align: center;">
          Ce lien est valable pendant 24 heures.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          GestExam - Centre de gestion scolaire
        </p>
      </div>
    `,
  };
}
