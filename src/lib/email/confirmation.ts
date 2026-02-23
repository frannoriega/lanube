'use server';
import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

const SMTP_SERVER_HOST = process.env.SMTP_SERVER_HOST;
const SMTP_SERVER_USERNAME = process.env.SMTP_SERVER_USERNAME;
const SMTP_SERVER_PASSWORD = process.env.SMTP_SERVER_PASSWORD;
const SMTP_SERVER_PORT = process.env.SMTP_SERVER_PORT;
const transporter = nodemailer.createTransport({
  host: SMTP_SERVER_HOST,
  port: SMTP_SERVER_PORT,
  secure: true,
  auth: {
    user: SMTP_SERVER_USERNAME,
    pass: SMTP_SERVER_PASSWORD,
  }
} as SMTPTransport.Options);

const FROM_EMAIL = "La Nube <no-responder@cdeluruguay.gob.ar>";

export async function sendEmailConfirmation(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.verify();
  } catch (error) {
    console.error('Error al verificar el servidor de correo', SMTP_SERVER_USERNAME, SMTP_SERVER_PASSWORD, error);
    return { success: false, error: 'Error al verificar el servidor de correo' };
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const confirmLink = `${baseUrl}/api/auth/confirm-email?token=${token}`;
  const logoUrl = "https://hbdpirnnyofbhbjx.public.blob.vercel-storage.com/email/logo.png";

  const info = await transporter.sendMail({
    from: FROM_EMAIL,
    to: [email],
    subject: "Confirma tu correo - La Nube",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${logoUrl}" alt="La Nube" width="200" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #666; margin: 10px 0;">Espacio de Coworking e Innovación</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">¡Confirma tu correo!</h2>
          <p style="color: #555; line-height: 1.6;">
            Has creado una cuenta en La Nube. Haz clic en el botón de abajo para confirmar tu correo electrónico y continuar con el registro:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmLink}" 
               style="background: #4E87C2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              Confirmar correo electrónico
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${confirmLink}" style="color: #4E87C2;">${confirmLink}</a>
          </p>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>Este enlace expirará en 24 horas por seguridad.</p>
          <p>Si no creaste esta cuenta, puedes ignorar este email.</p>
        </div>
      </div>
    `,
  });

  if (info.rejected.length > 0) {
    return { success: false, error: 'Error al enviar el email' };
  }
  return { success: true };
}
