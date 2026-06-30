"use server";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER_HOST,
  port: process.env.SMTP_SERVER_PORT,
  secure: process.env.SMTP_SERVER_SECURE === "true",
  auth: {
    user: process.env.SMTP_SERVER_USERNAME,
    pass: process.env.SMTP_SERVER_PASSWORD,
  },
} as SMTPTransport.Options);

const FROM_EMAIL = "La Nube <no-responder@cdeluruguay.gob.ar>";

export async function sendEventRegistrationEmail(
  email: string,
  eventName: string,
  editToken: string,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";
  const editLink = `${baseUrl}/forms/response/${encodeURIComponent(editToken)}`;
  const logoUrl =
    "https://hbdpirnnyofbhbjx.public.blob.vercel-storage.com/email/logo.png";

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: [email],
      subject: `Inscripción confirmada: ${eventName} - La Nube`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${logoUrl}" alt="La Nube" width="200" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #666; margin: 10px 0;">Espacio de Coworking e Innovación</p>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">¡Inscripción confirmada!</h2>
          <p style="color: #555; line-height: 1.6;">
            Te inscribiste a <strong>${eventName}</strong>. Podés editar o cancelar tu
            inscripción en cualquier momento con el siguiente botón:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${editLink}"
               style="background: #4E87C2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              Ver / editar mi inscripción
            </a>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${editLink}" style="color: #4E87C2;">${editLink}</a>
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>Guardá este correo: el enlace es tu acceso para gestionar la inscripción.</p>
        </div>
      </div>
    `,
    });

    if (info.rejected.length > 0) {
      return { success: false, error: "Error al enviar el email" };
    }
    return { success: true };
  } catch (error) {
    console.error("Error al enviar email de inscripción", error);
    return { success: false, error: "Error al enviar el email" };
  }
}
