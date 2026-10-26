import nodemailer from 'nodemailer';
import { AppError } from './errors';
export async function sendLink(email: string, token: string, type: 'verify' | 'reset') {
  const host = process.env.SMTP_HOST;
  if (!host)
    throw new AppError(503, 'E-posta servisi yapılandırılmamış. Kurum yöneticisine başvurun.');
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.NODE_ENV === 'production',
    dnsTimeout: 5000,
    greetingTimeout: 10000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
  const link = new URL(
    type === 'verify' ? '/eposta-dogrula' : '/sifre-yenile',
    process.env.APP_URL,
  );
  link.searchParams.set('token', token);
  const title = type === 'verify' ? 'E-posta adresinizi doğrulayın' : 'Şifrenizi yenileyin';
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'Akademi <noreply@akademi.local>',
      to: email,
      subject: `Akademi — ${title}`,
      text: `${title}\n\n${link.toString()}\n\nBu bağlantı tek kullanımlıktır. İsteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz.`,
      html: `<div style="font:15px system-ui;color:#171717;max-width:480px;margin:32px auto"><p>AKADEMİ</p><h2>${title}</h2><p>Devam etmek için aşağıdaki bağlantıyı kullanın.</p><p><a href="${link.toString()}" style="color:#2563eb">${title}</a></p><p>Bağlantı tek kullanımlıktır. İsteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz.</p></div>`,
    });
  } catch {
    throw new AppError(503, 'E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.');
  }
}
