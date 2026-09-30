// Шифрование контента и синхронизации. Один и тот же модуль работает
// в браузере (WebCrypto) и в Node 20+ (globalThis.crypto) — им пользуются
// и приложение, и сборщик недели tools/kl.mjs.
//
// Схема: PBKDF2-SHA256(семейный пароль, соль из content/manifest.json) → 512 бит.
//   первые 256 бит — ключ AES-256-GCM для файлов и данных синхронизации;
//   вторые 256 бит — ключ HMAC для имён файлов, токена синхронизации и PIN.

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export const KDF_ITERATIONS = 300000;
export const MIN_PASSWORD_LENGTH = 12;

export function toB64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomB64(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return toB64(b);
}

/** Пароль → 64 байта «мастер-ключа». Медленно (~0,3 с), вызывается один раз на устройстве. */
export async function deriveMaster(password, kdf) {
  const base = await subtle().importKey('raw', te.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(kdf.salt), iterations: kdf.iter },
    base,
    512
  );
  return new Uint8Array(bits);
}

export async function importMaster(master) {
  const enc = await subtle().importKey('raw', master.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const mac = await subtle().importKey('raw', master.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return { enc, mac };
}

/** label привязывает шифротекст к роли файла (index / week / sync:<slot>), чтобы файлы нельзя было подменить друг другом. */
export async function encryptJSON(keys, obj, label) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: te.encode(label) },
    keys.enc,
    te.encode(JSON.stringify(obj))
  );
  return { v: 1, alg: 'AES-256-GCM', iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

export async function decryptJSON(keys, env, label) {
  if (!env || env.v !== 1 || !env.iv || !env.ct) throw new Error('bad-envelope');
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: fromB64(env.iv), additionalData: te.encode(label) },
    keys.enc,
    fromB64(env.ct)
  );
  return JSON.parse(td.decode(pt));
}

export async function hmacHex(keys, msg) {
  const sig = new Uint8Array(await subtle().sign('HMAC', keys.mac, te.encode(msg)));
  return Array.from(sig, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Имя зашифрованного файла недели: не раскрывает даты, но стабильно для одной и той же недели. */
export async function weekFileName(keys, weekId) {
  return 'w-' + (await hmacHex(keys, 'week-file:' + weekId)).slice(0, 16) + '.enc';
}

export async function syncToken(keys) {
  return hmacHex(keys, 'sync-token-v1');
}

export async function pinHash(keys, profileId, pin) {
  return (await hmacHex(keys, 'pin-v1:' + profileId + ':' + pin)).slice(0, 32);
}
