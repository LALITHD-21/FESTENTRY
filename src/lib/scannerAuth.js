export const SCANNER_ACCOUNTS = [
  { id: 'S01', password: 'VIVAN@01', label: 'Gate Scanner 01' },
  { id: 'S02', password: 'VIVAN@02', label: 'Gate Scanner 02' },
  { id: 'S03', password: 'VIVAN@03', label: 'Gate Scanner 03' },
  { id: 'S04', password: 'VIVAN@04', label: 'Gate Scanner 04' },
  { id: 'S05', password: 'VIVAN@05', label: 'Gate Scanner 05' },
  { id: 'S06', password: 'VIVAN@06', label: 'Gate Scanner 06' },
  { id: 'S07', password: 'VIVAN@07', label: 'Gate Scanner 07' },
  { id: 'S08', password: 'VIVAN@08', label: 'Gate Scanner 08' },
  { id: 'S09', password: 'VIVAN@09', label: 'Gate Scanner 09' },
  { id: 'S10', password: 'VIVAN@10', label: 'Gate Scanner 10' },
];

export const ADMIN_ACCOUNT = {
  id: 'ADMIN',
  password: 'VG@2026',
};

const SCANNER_SESSION_KEY = 'vivan-scanner-member-session';
const ADMIN_SESSION_KEY = 'vivan-admin-session';

export function authenticateScanner(scannerId, password, scannerName) {
  const normalizedId = String(scannerId || '').trim().toUpperCase();
  const account = SCANNER_ACCOUNTS.find((item) => item.id === normalizedId);

  if (!account || account.password !== String(password || '').trim()) {
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
