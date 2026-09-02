import { Resend } from 'resend';
import { env } from '../config/env';
import { AppError } from './errors';

let client: Resend | null = null;

function getClient(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Email is not configured');
  }
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export async function sendOtpEmail(to: string, code: string, locale: 'ar' | 'en' = 'ar'): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (!env.isProd) {
      console.log(`[dev] OTP for ${to}: ${code}`);
      return;
    }
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Email is not configured');
  }

  const subject = locale === 'en' ? 'Your Cutie Dreams reset code' : 'رمز استعادة كلمة المرور — Cutie Dreams';
  const body =
    locale === 'en'
      ? `<p>Your password reset code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>It expires in 10 minutes.</p>`
      : `<p dir="rtl">رمز استعادة كلمة المرور:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p dir="rtl">ينتهي خلال ١٠ دقائق.</p>`;

  const { error } = await getClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html: body,
  });

  if (error) {
    throw new AppError(502, 'MAIL_FAILED', error.message);
  }
}
