// Idempotent per-install device keypair generator (Curve25519 sealed-box)
// - Generates X25519 keypair via libsodium (crypto_box)
// - Stores private key as base64 in 0600 file
// - Stores public key as base64
// - Sets only the necessary env vars if not already present:
//     CRED_SEALBOX_PRIVATE_KEY_PATH            (backend)
//     VITE_CRED_SEALBOX_PUBLIC_KEY_B64         (frontend build)
//
// Safe to call at first-run initialization. Re-runs are no-ops if keys exist.

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import sodium from 'libsodium-wrappers-sumo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAppConfigDir(appName = 'claude-linkedin') {
  const platform = process.platform;
  if (platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, appName);
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  }
  // linux/unix
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, appName);
}

async function ensureDir(dirPath, mode = 0o700) {
  await fsp.mkdir(dirPath, { recursive: true, mode });
}

function isProbablyBase64Key(str, expectedLenBytes = 32) {
  if (typeof str !== 'string' || str.length < 40) return false;
  try {
    const buf = Buffer.from(str.trim(), 'base64');
    return buf.length === expectedLenBytes; // 32 for X25519 pub/priv keys
  } catch {
    return false;
  }
}

async function readFileIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return null;
    throw e;
  }
}

async function writeEnvKV(envPath, kvPairs) {
  // Append only missing keys, preserve existing values
  const existing = (await readFileIfExists(envPath)) ?? '';
  const lines = existing.split(/\r?\n/);
  const haveKey = (k) => lines.some((ln) => ln.trim().startsWith(`${k}=`));

  const toAppend = [];
  for (const [k, v] of Object.entries(kvPairs)) {
    if (!haveKey(k) && typeof v === 'string' && v.length > 0) {
      toAppend.push(`${k}=${v}`);
    }
  }
  if (toAppend.length === 0) return;

  const content = (existing ? existing + '\n' : '') + toAppend.join('\n') + '\n';
  await fsp.writeFile(envPath, content, { encoding: 'utf8' });
}

async function ensureDeviceKeypair() {
  const appConfigDir = getAppConfigDir('claude-linkedin');
  const keysDir = path.join(appConfigDir, 'keys');
  const privateKeyPath = path.resolve(keysDir, 'device_private_key.b64');
  const publicKeyPath = path.resolve(keysDir, 'device_public_key.b64');

  await ensureDir(keysDir, 0o700);

  const existingPriv = await readFileIfExists(privateKeyPath);
  const existingPub = await readFileIfExists(publicKeyPath);

  let privB64 = existingPriv && existingPriv.trim();
  let pubB64 = existingPub && existingPub.trim();

  const validExisting = isProbablyBase64Key(privB64, 32) && isProbablyBase64Key(pubB64, 32);

  if (!validExisting) {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair(); // X25519 keys
    pubB64 = sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL);
    privB64 = sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL);

    // Write keys
    await fsp.writeFile(privateKeyPath, privB64 + '\n', { encoding: 'utf8', mode: 0o600 });
    try { await fsp.chmod(privateKeyPath, 0o600); } catch {}

    await fsp.writeFile(publicKeyPath, pubB64 + '\n', { encoding: 'utf8', mode: 0o644 });
  }

  // Prepare env variables
  const rootEnvPath = path.resolve(__dirname, '../../.env');

  // Write both backend and frontend vars into the single root .env
  await writeEnvKV(rootEnvPath, {
    CRED_SEALBOX_PRIVATE_KEY_PATH: privateKeyPath,
    VITE_CRED_SEALBOX_PUBLIC_KEY_B64: pubB64,
  });

  // Optional: emit summary for logs/CI
  process.stdout.write(JSON.stringify({
    ok: true,
    keysDir,
    privateKeyPath,
    publicKeyPath,
    env: {
      rootEnvPath,
      CRED_SEALBOX_PRIVATE_KEY_PATH: privateKeyPath,
      VITE_CRED_SEALBOX_PUBLIC_KEY_B64: 'set',
    }
  }) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureDeviceKeypair().catch((err) => {
    console.error('[generate-device-keypair] failed:', err);
    process.exit(1);
  });
}

export default ensureDeviceKeypair;


