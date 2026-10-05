import nodemailer from 'nodemailer';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || process.env.MAIL_USERNAME,
      pass: process.env.SMTP_PASS || process.env.MAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const fromAddress = () =>
  `"${process.env.SMTP_FROM_NAME || process.env.MAIL_FROM_NAME || 'DocLoq'}" <${
    process.env.SMTP_FROM || process.env.MAIL_FROM_ADDRESS || 'no-reply@docloq.site'
  }>`;

const appBaseUrl = () =>
  (process.env.APP_URL || process.env.FRONTEND_URL || 'https://docloq.site').replace(/\/$/, '');

// Footer links. Help Center points at the real contact page by default; Privacy
// and Terms render ONLY when their env URL is set, so the footer never shows a
// dead link. Override any of them via EMAIL_HELP_URL / EMAIL_PRIVACY_URL / EMAIL_TERMS_URL.
const footerLinks = () => {
  const app = appBaseUrl();
  const links = [{ label: 'Help Center', href: process.env.EMAIL_HELP_URL || `${app}/contact` }];
  if (process.env.EMAIL_PRIVACY_URL) links.push({ label: 'Privacy', href: process.env.EMAIL_PRIVACY_URL });
  if (process.env.EMAIL_TERMS_URL) links.push({ label: 'Terms', href: process.env.EMAIL_TERMS_URL });
  return links;
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const OTP_EXPIRY_MINUTES = 5;
export const PASSWORD_RESET_EXPIRY_MINUTES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Email design system — a single dark, wordmark-only shell shared by every email.
// No emoji and no SVG (both are stripped/inconsistent across Gmail/Outlook), and
// no decorative "icon" glyphs — the aesthetic is typographic: near-black surface,
// hairline borders, letter-spaced labels, monospace codes. All layout is table +
// inline-style based for mail-client compatibility.
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  page: '#08080a',
  card: '#101013',
  cardBorder: '#232327',
  inset: '#0a0a0c',
  insetBorder: '#2a2a30',
  textStrong: '#f4f4f5',
  text: '#d4d4d8',
  muted: '#a1a1aa',
  faint: '#71717a',
  hairline: '#1f1f23',
  accent: '#6366f1',
  accentSoft: '#a5b4fc',
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', 'JetBrains Mono', 'Courier New', Courier, monospace";

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Wraps content rows (a string of <tr>…</tr>) in the branded dark shell.
const renderShell = ({ title, preheader, contentHtml }) => {
  const footerCells = footerLinks()
    .map(
      (l, i) =>
        `${i > 0 ? `<td style="color:${C.hairline};">|</td>` : ''}<td style="padding:0 10px;"><a href="${escapeHtml(l.href)}" style="color:${C.faint}; font-size:12px;">${escapeHtml(l.label)}</a></td>`
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${C.page}; }
    a { text-decoration: none; }
    @media only screen and (max-width: 480px) {
      .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .card-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .code-value { font-size: 30px !important; letter-spacing: 8px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${C.page}; font-family:${FONT};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${C.page}; font-size:1px; line-height:1px;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.page};">
    <tr>
      <td align="center" style="padding:48px 20px;" class="mobile-pad">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px; width:100%;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <div style="font-size:16px; font-weight:700; letter-spacing:6px; color:${C.textStrong};">DOCLOQ</div>
              <div style="margin-top:6px; font-size:10px; font-weight:600; letter-spacing:3px; color:${C.faint};">SECURE DOCUMENT PLATFORM</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:${C.card}; border:1px solid ${C.cardBorder}; border-radius:16px; overflow:hidden;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="height:3px; background:linear-gradient(90deg, ${C.accent}, #8b5cf6 55%, transparent); font-size:0; line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td class="card-pad" style="padding:40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${contentHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 8px 0 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>${footerCells}</tr>
              </table>
              <p style="margin:16px 0 0 0; color:${C.faint}; font-size:12px; line-height:1.6;">
                &copy; ${new Date().getFullYear()} DocLoq &middot; All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Shared content fragments ----------------------------------------------------
const rowLabel = (text) => `
<tr><td style="padding:0 0 14px 0;">
  <span style="font-size:11px; font-weight:700; letter-spacing:2.5px; color:${C.accentSoft};">${escapeHtml(text)}</span>
</td></tr>`;

const rowHeading = (text) => `
<tr><td style="padding:0 0 14px 0;">
  <h1 style="margin:0; color:${C.textStrong}; font-size:24px; font-weight:700; letter-spacing:-0.4px; line-height:1.25;">${escapeHtml(text)}</h1>
</td></tr>`;

const rowParagraph = (html) => `
<tr><td style="padding:0 0 24px 0;">
  <p style="margin:0; color:${C.muted}; font-size:15px; line-height:1.65;">${html}</p>
</td></tr>`;

const rowDivider = () => `
<tr><td style="padding:24px 0 0 0;">
  <div style="height:1px; background-color:${C.hairline}; font-size:0; line-height:0;">&nbsp;</div>
</td></tr>`;

const rowFootnote = (html) => `
<tr><td style="padding:20px 0 0 0;">
  <p style="margin:0; color:${C.faint}; font-size:13px; line-height:1.6;">${html}</p>
</td></tr>`;

const greeting = (userName) =>
  userName ? `Hi <span style="color:${C.text};">${escapeHtml(userName)}</span>, ` : 'Hi, ';

// ── OTP email ────────────────────────────────────────────────────────────────
const generateOTPEmailHTML = (otp, userName) => {
  const contentHtml = `
    ${rowLabel('VERIFICATION CODE')}
    ${rowHeading("Confirm it's you")}
    ${rowParagraph(`${greeting(userName)}enter this code to finish signing in to your DocLoq account.`)}
    <tr><td style="padding:0 0 8px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.inset}; border:1px solid ${C.insetBorder}; border-radius:12px;">
        <tr><td align="center" style="padding:26px 20px;">
          <div class="code-value" style="font-family:${MONO}; font-size:36px; font-weight:700; letter-spacing:14px; color:${C.textStrong}; text-indent:14px;">${escapeHtml(otp)}</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:14px 0 0 0;">
      <p style="margin:0; color:${C.faint}; font-size:13px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
    </td></tr>
    ${rowDivider()}
    ${rowFootnote(`For your security, never share this code with anyone. DocLoq will never ask for your verification code by phone or email. If you didn't try to sign in, you can ignore this message.`)}
  `;
  return renderShell({
    title: 'Your DocLoq verification code',
    preheader: `${otp} is your DocLoq verification code (expires in ${OTP_EXPIRY_MINUTES} minutes).`,
    contentHtml,
  });
};

const generateOTPEmailText = (otp, userName) =>
  `DOCLOQ — Verification code

Hi${userName ? ` ${userName}` : ''},

Enter this code to finish signing in:

    ${otp}

This code expires in ${OTP_EXPIRY_MINUTES} minutes.

For your security, never share this code. DocLoq will never ask for it by phone or email.
If you didn't try to sign in, you can ignore this message.

© ${new Date().getFullYear()} DocLoq. All rights reserved.`.trim();

// ── Password reset email ─────────────────────────────────────────────────────
const generatePasswordResetHTML = (resetUrl, userName) => {
  const safeUrl = escapeHtml(resetUrl);
  const contentHtml = `
    ${rowLabel('PASSWORD RESET')}
    ${rowHeading('Reset your password')}
    ${rowParagraph(`${greeting(userName)}we received a request to reset the password for your DocLoq account. Choose a new password using the button below.`)}
    <tr><td style="padding:0 0 4px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" bgcolor="${C.accent}" style="border-radius:10px;">
            <a href="${safeUrl}" target="_blank" style="display:inline-block; padding:15px 34px; font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; border-radius:10px;">Reset password</a>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 0 0 0;">
      <p style="margin:0 0 8px 0; color:${C.faint}; font-size:13px;">Or paste this link into your browser:</p>
      <p style="margin:0; word-break:break-all;"><a href="${safeUrl}" target="_blank" style="color:${C.accentSoft}; font-size:13px;">${safeUrl}</a></p>
    </td></tr>
    <tr><td style="padding:16px 0 0 0;">
      <p style="margin:0; color:${C.faint}; font-size:13px;">This link expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes and can be used once.</p>
    </td></tr>
    ${rowDivider()}
    ${rowFootnote(`If you didn't request a password reset, you can safely ignore this email — your password won't change. For your protection, resetting your password signs out all other devices.`)}
  `;
  return renderShell({
    title: 'Reset your DocLoq password',
    preheader: `Reset your DocLoq password. This link expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes.`,
    contentHtml,
  });
};

const generatePasswordResetText = (resetUrl, userName) =>
  `DOCLOQ — Reset your password

Hi${userName ? ` ${userName}` : ''},

We received a request to reset the password for your DocLoq account.
Open this link to choose a new password:

${resetUrl}

This link expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes and can be used once.

If you didn't request a password reset, you can safely ignore this email — your
password won't change. For your protection, resetting your password signs out
all other devices.

© ${new Date().getFullYear()} DocLoq. All rights reserved.`.trim();

// ── Senders ──────────────────────────────────────────────────────────────────
export const sendOTPEmail = async (email, otp, userName = null) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: fromAddress(),
      to: email,
      subject: 'Your DocLoq verification code',
      text: generateOTPEmailText(otp, userName),
      html: generateOTPEmailHTML(otp, userName),
    });
    console.log('OTP Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { success: false, error: error.message };
  }
};

export const sendPasswordResetEmail = async (email, resetUrl, userName = null) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: fromAddress(),
      to: email,
      subject: 'Reset your DocLoq password',
      text: generatePasswordResetText(resetUrl, userName),
      html: generatePasswordResetHTML(resetUrl, userName),
    });
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Exposed for previews/tests — build the HTML without sending.
export {
  generateOTPEmailHTML as renderOtpEmailHtml,
  generatePasswordResetHTML as renderPasswordResetEmailHtml,
};

export const verifyEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('SMTP connection failed:', error);
    return false;
  }
};

export default {
  generateOTP,
  sendOTPEmail,
  sendPasswordResetEmail,
  verifyEmailConnection,
  OTP_EXPIRY_MINUTES,
  PASSWORD_RESET_EXPIRY_MINUTES,
};
