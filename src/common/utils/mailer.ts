import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

function hasSmtpConfig(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!hasSmtpConfig()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    logger.warn('SMTP not configured. Password reset email skipped.');
    return false;
  }

  const html = [
    `<p>Hi ${input.name || 'there'},</p>`,
    '<p>We received a request to reset your Finora password.</p>',
    `<p><a href="${input.resetUrl}">Reset your password</a></p>`,
    '<p>This link expires soon. If you did not request this, you can ignore this message.</p>',
  ].join('');

  await tx.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: 'Finora password reset',
    html,
    text: `Reset your password: ${input.resetUrl}`,
  });

  return true;
}
