export const SCANNER_ACCOUNTS = [
  { id: 'S01', password: 'VIMTECH@01', label: 'Gate Scanner 01' },
  { id: 'S02', password: 'VIMTECH@02', label: 'Gate Scanner 02' },
  { id: 'S03', password: 'VIMTECH@03', label: 'Gate Scanner 03' },
  { id: 'S04', password: 'VIMTECH@04', label: 'Gate Scanner 04' },
  { id: 'S05', password: 'VIMTECH@05', label: 'Gate Scanner 05' },
  { id: 'S06', password: 'VIMTECH@06', label: 'Gate Scanner 06' },
  { id: 'S07', password: 'VIMTECH@07', label: 'Gate Scanner 07' },
  { id: 'S08', password: 'VIMTECH@08', label: 'Gate Scanner 08' },
  { id: 'S09', password: 'VIMTECH@09', label: 'Gate Scanner 09' },
  { id: 'S10', password: 'VIMTECH@10', label: 'Gate Scanner 10' },
];

export const ADMIN_ACCOUNT = {
  id: 'ADMIN',
  password: 'VG@2026',
};

const SCANNER_SESSION_KEY = 'vivan-scanner-member-session';
const ADMIN_SESSION_KEY = 'vivan-admin-session';

export function authenticateScanner(scannerId, password, scannerName) {
  const normalizedId = normalizeScannerId(scannerId);
  const account = SCANNER_ACCOUNTS.find((item) => item.id === normalizedId);

  if (!account || !isScannerPasswordValid(account, password)) {
    throw new Error('Invalid scanner ID or password.');
  }

  const name = String(scannerName || '').trim();
  if (name.length < 2) {
    throw new Error('Enter scanner member name.');
  }

  return {
    scanner_id: account.id,
    scanner_name: name,
    scanner_label: account.label,
    login_at: new Date().toISOString(),
  };
}

export function normalizeScannerId(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  const match = raw.match(/^S?(\d{1,2})$/);
  if (!match) return raw;

  const scannerNumber = Number(match[1]);
  if (scannerNumber < 1 || scannerNumber > 10) return raw;

  return `S${String(scannerNumber).padStart(2, '0')}`;
}

function isScannerPasswordValid(account, password) {
  const typedPassword = String(password || '').trim();
  const scannerNumber = Number(account.id.replace('S', ''));
  const shortPassword = `VIMTECH@${scannerNumber}`;

  return typedPassword === account.password || typedPassword === shortPassword;
}

export function authenticateAdmin(adminId, password) {
  const normalizedId = String(adminId || '').trim().toUpperCase();
  if (normalizedId !== ADMIN_ACCOUNT.id || String(password || '').trim() !== ADMIN_ACCOUNT.password) {
    throw new Error('Invalid admin login.');
  }

  return {
    admin_id: ADMIN_ACCOUNT.id,
    login_at: new Date().toISOString(),
  };
}

export function getStoredScannerSession() {
  return readSession(SCANNER_SESSION_KEY);
}

export function storeScannerSession(session) {
  window.localStorage.setItem(SCANNER_SESSION_KEY, JSON.stringify(session));
}

export function clearScannerSession() {
  window.localStorage.removeItem(SCANNER_SESSION_KEY);
}

export function getStoredAdminSession() {
  return readSession(ADMIN_SESSION_KEY);
}

export function storeAdminSession(session) {
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

function readSession(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}
