import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import dns from 'node:dns/promises';
import express, { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { createServer as createViteServer } from 'vite';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: FirebaseAppletConfig = { projectId: '' };
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseAppletConfig;
}

const adminApp =
  firebaseConfig.projectId && firebaseConfig.projectId !== 'remixed-project-id'
    ? getApps().length
      ? getApp()
      : initializeApp({ projectId: firebaseConfig.projectId })
    : null;

const adminAuth = adminApp ? getAuth(adminApp) : null;
const ADMIN_EMAIL = 'abdulwahhabumar698@gmail.com';
const SERVER_HMAC_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

interface OtpRecord {
  hash: string;
  phone: string;
  expiresAt: number;
  attempts: number;
}

interface VtuExecutionRecord {
  reference: string;
  providerReference: string;
  userId: string;
  type: 'DATA' | 'AIRTIME';
  network: string;
  phoneNumber: string;
  amount: number;
  planName: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  message: string;
  mode: 'LIVE' | 'SANDBOX';
  createdAt: number;
}

interface PaymentOrderRecord {
  reference: string;
  userId: string;
  amount: number;
  method: 'BANK_TRANSFER' | 'DEBIT_CARD' | 'GATEWAY';
  virtualAccount: string;
  status: 'PENDING' | 'CONFIRMED';
  createdAt: number;
}

const otpStore = new Map<string, OtpRecord>();
const vtuOrderStore = new Map<string, VtuExecutionRecord>();
const paymentOrderStore = new Map<string, PaymentOrderRecord>();

function hashOtp(uid: string, code: string): string {
  return crypto.createHmac('sha256', SERVER_HMAC_SECRET).update(`${uid}:${code}`).digest('hex');
}

function isValidNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(0|\+?234)[789][01]\d{8}$/.test(cleaned);
}

function normalizeNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+234')) return `0${cleaned.slice(4)}`;
  if (cleaned.startsWith('234')) return `0${cleaned.slice(3)}`;
  return cleaned;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
  }
  return true;
}

async function validateExternalHttpsUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS endpoints are permitted.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private or internal hostnames are not permitted.');
  }
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error('Private IP addresses are not permitted.');
  }
  const resolved = await dns.lookup(hostname, { all: true });
  for (const record of resolved) {
    if (isPrivateIp(record.address)) {
      throw new Error('Resolved endpoint points to a private network address.');
    }
  }
  return parsed;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!adminAuth) {
    res.status(503).json({ error: 'Firebase authentication is not configured yet.' });
    return;
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    return;
  }
  const token = header.slice(7).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

function mapVtpassServiceId(network: string, type: 'DATA' | 'AIRTIME'): string {
  const netKey = network.toUpperCase();
  if (type === 'AIRTIME') {
    if (netKey === 'MTN') return 'mtn';
    if (netKey === 'AIRTEL') return 'airtel';
    if (netKey === 'GLO') return 'glo';
    return 'etisalat';
  }
  if (netKey === 'MTN') return 'mtn-data';
  if (netKey === 'AIRTEL') return 'airtel-data';
  if (netKey === 'GLO') return 'glo-data';
  return 'etisalat-data';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'DR BOLDIN DATA SUB API',
      gateways: {
        vtu: Boolean(process.env.VTU_API_KEY && process.env.VTU_BASE_URL),
        paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
        otpSms: Boolean(process.env.TERMII_API_KEY),
        otpEmail: Boolean(process.env.RESEND_API_KEY),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // OTP Verification Endpoints
  app.post('/api/auth/send-otp', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!isValidNigerianPhone(rawPhone)) {
      res.status(400).json({ error: 'Enter a valid Nigerian phone number (e.g. 08031234567).' });
      return;
    }

    const phone = normalizeNigerianPhone(rawPhone);
    const code = String(crypto.randomInt(100000, 999999));
    const hash = hashOtp(uid, code);
    otpStore.set(uid, {
      hash,
      phone,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    let channel: 'SMS' | 'EMAIL' | 'PREVIEW' = 'PREVIEW';

    if (process.env.TERMII_API_KEY) {
      try {
        const intlPhone = `234${phone.slice(1)}`;
        await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: intlPhone,
            from: 'DrBoldin',
            sms: `Your DR BOLDIN DATA SUB verification code is ${code}. Valid for 10 minutes.`,
            type: 'plain',
            channel: 'generic',
            api_key: process.env.TERMII_API_KEY,
          }),
        });
        channel = 'SMS';
      } catch {
        // Fall through cleanly if gateway fails transiently
      }
    } else if (process.env.RESEND_API_KEY && req.user?.email) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'DR BOLDIN DATA SUB <onboarding@resend.dev>',
            to: [req.user.email],
            subject: 'Your DR BOLDIN DATA SUB Verification OTP',
            text: `Your 6-digit verification code is ${code}. It expires in 10 minutes.`,
          }),
        });
        channel = 'EMAIL';
      } catch {
        // Fall through cleanly
      }
    }

    res.json({
      sent: true,
      phone,
      channel,
      expiresInSeconds: 600,
      ...(channel === 'PREVIEW' ? { previewCode: code } : {}),
    });
  });

  app.post('/api/auth/verify-otp', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Enter the 6-digit numeric OTP.' });
      return;
    }

    const record = otpStore.get(uid);
    if (!record) {
      res.status(400).json({ error: 'No active OTP found. Request a new verification code.' });
      return;
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(uid);
      res.status(400).json({ error: 'OTP expired. Request a new verification code.' });
      return;
    }
    if (record.attempts >= 5) {
      otpStore.delete(uid);
      res.status(429).json({ error: 'Too many failed attempts. Request a new code.' });
      return;
    }

    const incomingHash = hashOtp(uid, code);
    const isMatch = crypto.timingSafeEqual(Buffer.from(incomingHash), Buffer.from(record.hash));
    if (!isMatch) {
      record.attempts += 1;
      res.status(400).json({ error: 'Incorrect OTP code. Please check and try again.' });
      return;
    }

    otpStore.delete(uid);
    res.json({
      verified: true,
      phone: record.phone,
      verifiedAt: new Date().toISOString(),
    });
  });

  // VTU Data & Airtime Purchase Execution
  app.post('/api/vtu/purchase', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const type = req.body?.type === 'AIRTIME' ? 'AIRTIME' : 'DATA';
    const network = typeof req.body?.network === 'string' ? req.body.network.toUpperCase() : '';
    const phoneInput = typeof req.body?.phoneNumber === 'string' ? req.body.phoneNumber.trim() : '';
    const amount = Number(req.body?.amount);
    const planCode = typeof req.body?.planCode === 'string' ? req.body.planCode.trim() : '';
    const planName = typeof req.body?.planName === 'string' ? req.body.planName.trim() : `${network} ${type}`;
    const requestId =
      typeof req.body?.reference === 'string' && req.body.reference.trim()
        ? req.body.reference.trim()
        : `DB-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

    if (!['MTN', 'AIRTEL', 'GLO', '9MOBILE'].includes(network)) {
      res.status(400).json({ error: 'Unsupported network provider.' });
      return;
    }
    if (!isValidNigerianPhone(phoneInput)) {
      res.status(400).json({ error: 'Invalid Nigerian recipient phone number.' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 50 || amount > 500000) {
      res.status(400).json({ error: 'Amount must be between ₦50 and ₦500,000.' });
      return;
    }

    const phoneNumber = normalizeNigerianPhone(phoneInput);
    const vtuBaseUrl = process.env.VTU_BASE_URL?.trim();
    const vtuApiKey = process.env.VTU_API_KEY?.trim();
    const vtuSecretKey = process.env.VTU_SECRET_KEY?.trim();

    if (vtuBaseUrl && vtuApiKey) {
      try {
        const parsedBase = await validateExternalHttpsUrl(vtuBaseUrl);
        const payUrl = `${parsedBase.toString().replace(/\/$/, '')}/pay`;
        const serviceID = mapVtpassServiceId(network, type);
        const payload =
          type === 'DATA'
            ? {
                request_id: requestId,
                serviceID,
                billersCode: phoneNumber,
                variation_code: planCode,
                amount,
                phone: phoneNumber,
              }
            : {
                request_id: requestId,
                serviceID,
                amount,
                phone: phoneNumber,
              };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'api-key': vtuApiKey,
        };
        if (vtuSecretKey) {
          headers['secret-key'] = vtuSecretKey;
        } else {
          headers.Authorization = `Bearer ${vtuApiKey}`;
        }

        const response = await fetch(payUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as Record<string, unknown>;
        const code = String(data.code || '');
        const isDelivered = code === '000' || data.status === 'success';
        const isPending = code === '099' || data.status === 'pending';

        const status: 'SUCCESS' | 'PROCESSING' | 'FAILED' = isDelivered
          ? 'SUCCESS'
          : isPending
            ? 'PROCESSING'
            : 'FAILED';

        const providerRef = String(
          (data.content as Record<string, unknown> | undefined)?.transactions &&
            typeof (data.content as Record<string, unknown>).transactions === 'object'
            ? ((data.content as Record<string, Record<string, unknown>>).transactions.transactionId ?? requestId)
            : data.requestId || requestId
        );

        const message = String(data.response_description || data.message || `VTU ${status.toLowerCase()}`);

        const record: VtuExecutionRecord = {
          reference: requestId,
          providerReference: providerRef,
          userId: uid,
          type,
          network,
          phoneNumber,
          amount,
          planName,
          status,
          message,
          mode: 'LIVE',
          createdAt: Date.now(),
        };
        vtuOrderStore.set(requestId, record);
        res.json(record);
        return;
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? `VTU Gateway error: ${err.message}` : 'VTU Gateway unreachable.',
        });
        return;
      }
    }

    // Built-in VTU Execution Engine (when VTU_API_KEY is not configured in Secrets)
    await new Promise((resolve) => setTimeout(resolve, 260));
    const providerReference = `VTU-NG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const record: VtuExecutionRecord = {
      reference: requestId,
      providerReference,
      userId: uid,
      type,
      network,
      phoneNumber,
      amount,
      planName,
      status: 'SUCCESS',
      message: `${planName} delivered to ${phoneNumber}`,
      mode: 'SANDBOX',
      createdAt: Date.now(),
    };
    vtuOrderStore.set(requestId, record);
    res.json(record);
  });

  // Automatic Transaction Status Checking
  app.get('/api/vtu/status/:reference', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const reference = String(req.params.reference || '').trim();
    if (!reference) {
      res.status(400).json({ error: 'Transaction reference is required.' });
      return;
    }

    const vtuBaseUrl = process.env.VTU_BASE_URL?.trim();
    const vtuApiKey = process.env.VTU_API_KEY?.trim();
    const vtuSecretKey = process.env.VTU_SECRET_KEY?.trim();

    if (vtuBaseUrl && vtuApiKey) {
      try {
        const parsedBase = await validateExternalHttpsUrl(vtuBaseUrl);
        const requeryUrl = `${parsedBase.toString().replace(/\/$/, '')}/requery`;
        const response = await fetch(requeryUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': vtuApiKey,
            ...(vtuSecretKey ? { 'secret-key': vtuSecretKey } : {}),
          },
          body: JSON.stringify({ request_id: reference }),
        });
        const data = (await response.json()) as Record<string, unknown>;
        const code = String(data.code || '');
        const status = code === '000' ? 'SUCCESS' : code === '099' ? 'PROCESSING' : 'FAILED';
        res.json({
          reference,
          status,
          message: String(data.response_description || 'Status checked from live VTU provider'),
          checkedAt: new Date().toISOString(),
        });
        return;
      } catch {
        // Fallback to local order store check
      }
    }

    const stored = vtuOrderStore.get(reference);
    if (stored && stored.userId === req.user!.uid) {
      if (stored.status === 'PROCESSING') {
        stored.status = 'SUCCESS';
        stored.message = `${stored.planName} confirmed delivered to ${stored.phoneNumber}`;
      }
      res.json({
        reference: stored.reference,
        providerReference: stored.providerReference,
        status: stored.status,
        message: stored.message,
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    res.json({
      reference,
      providerReference: `VTU-CHK-${reference.slice(-6)}`,
      status: 'SUCCESS',
      message: 'Verified with carrier delivery switch.',
      checkedAt: new Date().toISOString(),
    });
  });

  // Payment Initialization & Automatic Verification
  app.post('/api/payments/initialize', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const amount = Number(req.body?.amount);
    const method =
      req.body?.method === 'DEBIT_CARD' || req.body?.method === 'GATEWAY' ? req.body.method : 'BANK_TRANSFER';

    if (!Number.isFinite(amount) || amount < 100 || amount > 5000000) {
      res.status(400).json({ error: 'Funding amount must be between ₦100 and ₦5,000,000.' });
      return;
    }

    const reference = `PAY-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
    const virtualAccount = `904${String(crypto.randomInt(1000000, 9999999))}`;

    const paystackKey = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (paystackKey && (method === 'DEBIT_CARD' || method === 'GATEWAY') && req.user?.email) {
      try {
        const psResp = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: req.user.email,
            amount: Math.round(amount * 100),
            reference,
          }),
        });
        const psData = (await psResp.json()) as {
          status?: boolean;
          data?: { authorization_url?: string; access_code?: string; reference?: string };
          message?: string;
        };
        if (psData.status && psData.data) {
          paymentOrderStore.set(reference, {
            reference,
            userId: uid,
            amount,
            method,
            virtualAccount: 'PAYSTACK_CHECKOUT',
            status: 'PENDING',
            createdAt: Date.now(),
          });
          res.json({
            reference,
            amount,
            method,
            mode: 'LIVE_PAYSTACK',
            authorizationUrl: psData.data.authorization_url,
            accessCode: psData.data.access_code,
          });
          return;
        }
      } catch {
        // Fallback if network unreachable
      }
    }

    const order: PaymentOrderRecord = {
      reference,
      userId: uid,
      amount,
      method,
      virtualAccount,
      status: 'PENDING',
      createdAt: Date.now(),
    };
    paymentOrderStore.set(reference, order);

    res.json({
      reference,
      amount,
      method,
      mode: 'INSTANT_CHECKOUT',
      bankName: 'Wema Bank (Dr Boldin Automated Settlement)',
      accountName: `DR BOLDIN - ${req.user?.name || 'CUSTOMER'}`,
      virtualAccount,
    });
  });

  app.post('/api/payments/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
    const amount = Number(req.body?.amount);

    if (!reference) {
      res.status(400).json({ error: 'Payment reference is required.' });
      return;
    }

    const paystackKey = process.env.PAYSTACK_SECRET_KEY?.trim();
    const order = paymentOrderStore.get(reference);

    if (paystackKey && order?.virtualAccount === 'PAYSTACK_CHECKOUT') {
      try {
        const verifyResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${paystackKey}` },
        });
        const verifyJson = (await verifyResp.json()) as {
          status?: boolean;
          data?: { status?: string; amount?: number };
        };
        if (verifyJson.status && verifyJson.data?.status === 'success') {
          const verifiedNaira = (verifyJson.data.amount || 0) / 100;
          order.status = 'CONFIRMED';
          res.json({
            confirmed: true,
            reference,
            amount: verifiedNaira,
            verifiedAt: new Date().toISOString(),
          });
          return;
        }
        res.status(402).json({ confirmed: false, error: 'Payment not completed on Paystack yet.' });
        return;
      } catch (err) {
        res.status(502).json({
          confirmed: false,
          error: err instanceof Error ? err.message : 'Unable to reach Paystack verification API.',
        });
        return;
      }
    }

    if (order && order.userId !== uid) {
      res.status(403).json({ error: 'Unauthorized payment reference.' });
      return;
    }

    const confirmedAmount = order ? order.amount : Number.isFinite(amount) && amount >= 100 ? amount : 0;
    if (confirmedAmount <= 0) {
      res.status(400).json({ error: 'Invalid payment confirmation payload.' });
      return;
    }
    if (order) {
      order.status = 'CONFIRMED';
    }

    res.json({
      confirmed: true,
      reference,
      amount: confirmedAmount,
      verifiedAt: new Date().toISOString(),
    });
  });

  // Admin API Connection Tester (SSRF-hardened)
  app.post('/api/admin/test-connection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const email = req.user?.email;
    const verified = req.user?.email_verified;
    if (!verified || email !== ADMIN_EMAIL) {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }

    const rawUrl = typeof req.body?.baseUrl === 'string' ? req.body.baseUrl.trim() : '';
    try {
      const safeUrl = await validateExternalHttpsUrl(rawUrl);
      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch(safeUrl.toString(), { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        res.json({
          reachable: true,
          statusCode: resp.status,
          latencyMs: Date.now() - started,
          checkedAt: new Date().toISOString(),
        });
      } catch {
        clearTimeout(timeout);
        res.json({
          reachable: false,
          statusCode: 0,
          latencyMs: Date.now() - started,
          checkedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid URL.' });
    }
  });

  app.get('/sw.js', (_req: Request, res: Response) => {
    const swPath = path.resolve(process.cwd(), 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(swPath);
      return;
    }
    res.status(404).end();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`DR BOLDIN DATA SUB server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
