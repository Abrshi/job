import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export interface SendVerificationEmailOptions {
  to: string;
  recipientName?: string;
  verificationToken: string;
  verificationCode: string;
  expiresInMinutes?: number;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    const user = env.EMAIL_USER?.trim();
    // Google App Passwords are 16 alphanumeric characters, often formatted with spaces: "aaaa bbbb cccc dddd"
    const pass = env.GOOGLE_APP_PASSWORD?.replace(/\s+/g, '').trim();

    if (!user || !pass) {
      logger.warn('[EmailService] SMTP credentials missing (EMAIL_USER or GOOGLE_APP_PASSWORD). Emails will not be sent.');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // SSL
        auth: {
          user,
          pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000,
      });

      this.isConfigured = true;
      logger.info(`[EmailService] Initialized Gmail SMTP transport for sender: ${user}`);
    } catch (err: any) {
      logger.error(`[EmailService] Failed to initialize nodemailer transport: ${err.message}`);
      this.isConfigured = false;
    }
  }

  /**
   * Verify whether SMTP credentials and network connection are working.
   */
  public async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      return { success: false, error: 'Email service is not configured (missing EMAIL_USER or GOOGLE_APP_PASSWORD).' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (err: any) {
      logger.error(`[EmailService] SMTP verification failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send an email verification link and 6-digit code.
   */
  public async sendVerificationEmail(options: SendVerificationEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { to, recipientName, verificationToken, verificationCode, expiresInMinutes = 10 } = options;

    if (!this.isConfigured || !this.transporter) {
      logger.warn(`[EmailService] Skipping verification email to ${to}: service unconfigured.`);
      return { success: false, error: 'Email delivery not configured.' };
    }

    const frontendOrigin = env.FRONTEND_ORIGIN.replace(/\/+$/, '');
    const verificationUrl = `${frontendOrigin}/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(to)}`;
    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';

  
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Verify your JobPlatform Account</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
        Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    .email-wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 40px 16px;
    }

    .email-container {
      width: 100%;
      max-width: 560px;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
    }

    .header {
      background-color: #0f172a;
      padding: 30px 24px;
      text-align: center;
    }

    .logo {
      font-size: 25px;
      line-height: 32px;
      font-weight: 800;
      letter-spacing: -0.8px;
      color: #ffffff;
      text-decoration: none;
    }

    .logo-highlight {
      color: #38bdf8;
    }

    .header-caption {
      margin: 8px 0 0;
      font-size: 12px;
      line-height: 18px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .content {
      padding: 40px 36px 36px;
    }

    .eyebrow {
      margin: 0 0 12px;
      color: #0284c7;
      font-size: 12px;
      line-height: 18px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    .title {
      margin: 0 0 18px;
      color: #0f172a;
      font-size: 26px;
      line-height: 34px;
      font-weight: 750;
      letter-spacing: -0.7px;
    }

    .text {
      margin: 0 0 18px;
      color: #475569;
      font-size: 15px;
      line-height: 25px;
    }

    .button-container {
      padding: 12px 0 24px;
      text-align: center;
    }

    .button {
      display: inline-block;
      background-color: #0284c7;
      background-image: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
      border: 1px solid #0284c7;
      border-radius: 10px;
      color: #ffffff !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      line-height: 20px;
      font-weight: bold;
      letter-spacing: 0.2px;
      text-align: center;
      text-decoration: none !important;
      padding: 16px 30px;
      box-shadow: 0 4px 10px rgba(2, 132, 199, 0.20);
      -webkit-text-size-adjust: none;
      mso-padding-alt: 0;
    }

    .button-arrow {
      color: #ffffff;
      font-size: 18px;
      font-weight: normal;
    }

    .alternative-text {
      margin: 0 0 14px;
      color: #64748b;
      font-size: 13px;
      line-height: 21px;
      text-align: center;
    }

    .code-box {
      margin: 0 0 24px;
      padding: 22px 16px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      text-align: center;
    }

    .code-label {
      margin: 0 0 10px;
      color: #64748b;
      font-size: 11px;
      line-height: 16px;
      font-weight: 700;
      letter-spacing: 1.8px;
      text-transform: uppercase;
    }

    .code-value {
      margin: 0;
      color: #0369a1;
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      line-height: 40px;
      font-weight: bold;
      letter-spacing: 7px;
      overflow-wrap: anywhere;
    }

    .expiry-notice {
      margin: 0;
      padding: 16px;
      background-color: #f8fafc;
      border-left: 3px solid #38bdf8;
      border-radius: 4px;
      color: #64748b;
      font-size: 13px;
      line-height: 21px;
    }

    .footer {
      padding: 24px 28px;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }

    .footer-text {
      margin: 0;
      color: #94a3b8;
      font-size: 12px;
      line-height: 20px;
    }

    .footer-brand {
      color: #64748b;
      font-weight: 700;
    }

    @media only screen and (max-width: 480px) {
      .email-wrapper {
        padding: 16px 8px !important;
      }

      .content {
        padding: 30px 22px !important;
      }

      .title {
        font-size: 23px !important;
        line-height: 31px !important;
      }

      .button {
        display: block !important;
        padding: 16px 12px !important;
      }

      .code-value {
        font-size: 28px !important;
        letter-spacing: 5px !important;
      }

      .footer {
        padding: 22px 16px !important;
      }
    }
  </style>
</head>

<body>
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    class="email-wrapper"
  >
    <tr>
      <td align="center">

        <table
          role="presentation"
          width="560"
          cellpadding="0"
          cellspacing="0"
          border="0"
          class="email-container"
          style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;"
        >
          <!-- Header -->
          <tr>
            <td class="header" style="background-color:#0f172a;padding:30px 24px;text-align:center;">
              <div class="logo" style="font-size:25px;line-height:32px;font-weight:800;letter-spacing:-0.8px;color:#ffffff;">
                Job<span class="logo-highlight" style="color:#38bdf8;">Platform</span>
              </div>
              <p class="header-caption" style="margin:8px 0 0;font-size:12px;line-height:18px;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">
                Your next opportunity starts here
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td class="content" style="padding:40px 36px 36px;">

              <p class="eyebrow" style="margin:0 0 12px;color:#0284c7;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                Account security
              </p>

              <h1 class="title" style="margin:0 0 18px;color:#0f172a;font-size:26px;line-height:34px;font-weight:750;letter-spacing:-0.7px;">
                Verify your email address
              </h1>

              <p class="text" style="margin:0 0 18px;color:#475569;font-size:15px;line-height:25px;">
                ${greeting}
              </p>

              <p class="text" style="margin:0 0 18px;color:#475569;font-size:15px;line-height:25px;">
                Thank you for joining JobPlatform. You're one step away from completing your account setup and accessing your career opportunities.
              </p>

              <!-- Premium verification button -->
              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
                align="center"
                style="margin:12px auto 24px;"
              >
                <tr>
                  <td
                    align="center"
                    bgcolor="#0284c7"
                    style="border-radius:10px;background-color:#0284c7;"
                  >
                    <a
                      href="${verificationUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="button"
                      style="display:inline-block;background-color:#0284c7;background-image:linear-gradient(135deg,#0ea5e9 0%,#0369a1 100%);border:1px solid #0284c7;border-radius:10px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;letter-spacing:0.2px;text-align:center;text-decoration:none;padding:16px 30px;"
                    >
                      <span style="color:#ffffff;">Verify Email Address</span>
                      &nbsp;
                      <span class="button-arrow" style="color:#ffffff;font-size:18px;">&#8594;</span>
                    </a>
                  </td>
                </tr>
              </table>

              <p class="alternative-text" style="margin:0 0 14px;color:#64748b;font-size:13px;line-height:21px;text-align:center;">
                Prefer another way? Enter this verification code on the verification page.
              </p>

              <!-- Verification code -->
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin:0 0 24px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;"
              >
                <tr>
                  <td align="center" style="padding:22px 16px;">
                    <p class="code-label" style="margin:0 0 10px;color:#64748b;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">
                      Your verification code
                    </p>
                    <p class="code-value" style="margin:0;color:#0369a1;font-family:'Courier New',Courier,monospace;font-size:32px;line-height:40px;font-weight:bold;letter-spacing:7px;">
                      ${verificationCode}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Expiration notice -->
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="background-color:#f8fafc;border-left:3px solid #38bdf8;"
              >
                <tr>
                  <td style="padding:16px;">
                    <p class="expiry-notice" style="margin:0;color:#64748b;font-size:13px;line-height:21px;">
                      <strong style="color:#334155;">Important:</strong>
                      This verification link and code will expire in
                      <strong style="color:#334155;">${expiresInMinutes} minutes</strong>.
                      If you didn't create a JobPlatform account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer" style="padding:24px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p class="footer-text" style="margin:0;color:#94a3b8;font-size:12px;line-height:20px;">
                Sent with care by <span class="footer-brand" style="color:#64748b;font-weight:700;">JobPlatform</span>
              </p>
              <p class="footer-text" style="margin:6px 0 0;color:#94a3b8;font-size:12px;line-height:20px;">
                &copy; ${new Date().getFullYear()} JobPlatform. All rights reserved.
              </p>
              <p class="footer-text" style="margin:8px 0 0;color:#94a3b8;font-size:11px;line-height:18px;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;


    const textContent = `
Verify your JobPlatform Account

${greeting}

Please use the following 6-digit code to verify your email address:
${verificationCode}

Or visit this URL in your browser:
${verificationUrl}

This code will expire in ${expiresInMinutes} minutes.
If you did not request this, you can safely ignore this email.
    `.trim();

    try {
      const info = await this.transporter.sendMail({
        from: `"JobPlatform" <${env.EMAIL_USER}>`,
        to,
        subject: `Verify your JobPlatform account [${verificationCode}]`,
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Verification email sent to ${to} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      logger.error(`[EmailService] Failed to send email to ${to}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

export const emailService = new EmailService();
