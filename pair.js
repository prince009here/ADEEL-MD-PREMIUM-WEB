const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const router = express.Router();

function removeFolder(folderPath) {
  if (fs.existsSync(folderPath)) {
    try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch {}
  }
}

/**
 * GET /code?number=923XXXXXXXXX
 * Returns:
 *  - { status: "pairing-started", code: "123-456" }
 *  - { status: "connected", code: "ADEEL-MD~<base64>" }
 *  - { status: "error", message: "..." }
 */
router.get('/code', async (req, res) => {
  const id = makeid();
  const tempDir = path.join(__dirname, 'temp', id);
  const phoneNumber = (req.query.number || '').replace(/\D/g, '');

  if (!phoneNumber || phoneNumber.length < 8) {
    return res.status(400).send({ status: 'error', message: '❌ Please provide a valid phone number.' });
  }

  async function createSocketSession() {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    const logger = pino({ level: 'fatal' }).child({ level: 'fatal' });

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      logger,
      syncFullHistory: false,
      browser: Browsers.macOS('Safari'),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update || {};

      if (connection === 'open') {
        try {
          // wait a breath
          await delay(2500);

          // build session
          const credsPath = path.join(tempDir, 'creds.json');
          const sessionData = fs.readFileSync(credsPath, 'utf8');
          const base64 = Buffer.from(sessionData).toString('base64');
          const sessionId = 'ADEEL-MD~' + base64;

          // DM session ID to self
          await sock.sendMessage(sock.user.id, { text: sessionId });

          // Pretty success message
          const successMsg = {
            text:
              `⚡ *ADEEL-MD Session Created!*\n\n` +
              `▸ *Never share* your session ID 🔒\n` +
              `▸ Join our WhatsApp Channel 🚀\n` +
              `▸ Report bugs on GitHub 🛠️\n\n` +
              `_Futuristic pairing completed ✅_\n\n` +
              `🔗 *Useful Links:*\n` +
              `▸ GitHub: https://github.com/abdullah219660/ADEEL-MD\n` +
              `▸ Channel: https://whatsapp.com/channel/0029Vb6HUGv0G0XmD5RKrA3G`,
            contextInfo: {
              mentionedJid: [sock.user.id],
              forwardingScore: 1000,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: '0029Vb6HUGv0G0XmD5RKrA3G@newsletter',
                newsletterName: 'ADEEL-MD',
                serverMessageId: 143,
              },
            },
          };
          await sock.sendMessage(sock.user.id, successMsg);

          if (!res.headersSent) {
            res.send({ status: 'connected', message: '✅ Pairing successful', code: sessionId });
          }
        } catch (err) {
          console.error('❌ Session Error:', err?.message || err);
          if (!res.headersSent) {
            res.status(500).send({
              status: 'error',
              message: err?.message?.includes('rate limit')
                ? '⚠️ Server is busy. Try later.'
                : `⚠️ ${err?.message || 'Unknown error'}`,
            });
          }
        } finally {
          try { await delay(750); await sock.ws.close(); } catch {}
          removeFolder(tempDir);
          console.log('✅ session completed');
          // Do not exit process on Render
        }
      } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
        console.log('🔁 Reconnecting...');
        await delay(50);
        createSocketSession().catch(()=>{});
      }
    });

    // If device not registered yet → request pairing code
    if (!sock.authState.creds.registered) {
      await delay(1200);
      const pairingCode = await sock.requestPairingCode(phoneNumber, 'EDITH123');
      if (!res.headersSent) {
        return res.send({
          status: 'pairing-started',
          code: pairingCode,
          message: '🔑 Use this code to pair your WhatsApp',
        });
      }
    }
  }

  try {
    await createSocketSession();
  } catch (err) {
    console.error('🚨 Fatal Error:', err?.message || err);
    removeFolder(tempDir);
    if (!res.headersSent) {
      res.status(500).send({ status: 'error', message: '❌ Service Unavailable. Try again later.' });
    }
  }
});

module.exports = router;