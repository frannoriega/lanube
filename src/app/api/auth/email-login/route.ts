import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { auth } from "@/lib/auth"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { message: "Email es requerido" },
        { status: 400 }
      )
    }

    // Create a magic link token (in a real app, you'd generate a secure token)
    const magicLinkToken = Buffer.from(`${email}:${Date.now()}`).toString('base64')
    const magicLink = `${process.env.NEXTAUTH_URL}/auth/magic-link?token=${magicLinkToken}`

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'La Nube <noreply@lanube.com>', // You'll need to verify this domain
      to: [email],
      subject: 'Inicia sesión en La Nube',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4E87C2; font-size: 32px; margin: 0;">🌩️ La Nube</h1>
            <p style="color: #666; margin: 10px 0;">Espacio de Coworking e Innovación</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">¡Hola!</h2>
            <p style="color: #555; line-height: 1.6;">
              Has solicitado iniciar sesión en La Nube. Haz clic en el botón de abajo para acceder a tu cuenta:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" 
                 style="background: #4E87C2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Iniciar Sesión en La Nube
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:<br>
              <a href="${magicLink}" style="color: #4E87C2;">${magicLink}</a>
            </p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>Este enlace expirará en 24 horas por seguridad.</p>
            <p>Si no solicitaste este acceso, puedes ignorar este email.</p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { message: "Error al enviar el email" },
        { status: 500 }
      )
    }

    console.log('Email sent successfully:', data)

    return NextResponse.json(
      { message: "Email enviado exitosamente" },
      { status: 200 }
    )

  } catch (error) {
    console.error('Email login error:', error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
