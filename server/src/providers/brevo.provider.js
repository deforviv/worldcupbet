const axios = require('axios');
const { brevo } = require('../config/env');
const logger = require('../config/logger');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function assertBrevoConfig() {
  if (!brevo.apiKey || !brevo.senderEmail) {
    throw Object.assign(new Error('Brevo email service is not configured'), { status: 500 });
  }
}

async function sendVerificationEmail({ to, name, code, expiresInMinutes }) {
  assertBrevoConfig();

  const displayName = name || to;

  try {
    await axios.post(
      BREVO_API_URL,
      {
        sender: {
          email: brevo.senderEmail,
          name: brevo.senderName,
        },
        to: [{ email: to, name: displayName }],
        subject: 'Votre code de confirmation WorldCupBet',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
            <h2 style="color:#dc2626;margin-bottom:8px">WorldCupBet</h2>
            <p>Bonjour ${displayName},</p>
            <p>Voici votre code de confirmation :</p>
            <div style="font-size:28px;font-weight:800;letter-spacing:8px;color:#dc2626;margin:20px 0">
              ${code}
            </div>
            <p>Ce code expire dans ${expiresInMinutes} minutes.</p>
            <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.</p>
          </div>
        `,
        textContent: `WorldCupBet - Votre code de confirmation est ${code}. Il expire dans ${expiresInMinutes} minutes.`,
      },
      {
        headers: {
          accept: 'application/json',
          'api-key': brevo.apiKey,
          'content-type': 'application/json',
        },
        timeout: 15000,
      }
    );

    logger.info(`[Brevo] Verification email sent to ${to}`);
  } catch (err) {
    logger.error('[Brevo] Failed to send verification email', {
      email: to,
      status: err.response?.status,
      error: err.response?.data || err.message,
    });
    throw Object.assign(new Error('Verification email could not be sent'), { status: 502 });
  }
}

module.exports = { sendVerificationEmail };
