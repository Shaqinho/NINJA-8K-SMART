// ============================================================================
// NINJA API — CMS Communication Service
// Base URL: https://ninja-apps.io/api/
// ============================================================================

const BASE_URL = 'https://ninja-apps.io/api';

// Temporary device ID — will be replaced with Widevine/Capacitor ID later
const getDeviceId = async () => {
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getId();
    const id = info.identifier || info.uuid || 'unknown';
    console.log('[NinjaAPI] Device ID:', id);
    return id;
  } catch (e) {
    // Fallback: persistent localStorage ID
    let id = localStorage.getItem('ninja_device_id');
    if (!id) {
      id = 'web_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('ninja_device_id', id);
    }
    console.log('[NinjaAPI] Device ID (fallback):', id);
    return id;
  }
};

// ============================================================================
// AUTH — Token login → returns Xtream credentials
// ============================================================================
export const authWithToken = async (token) => {
  const deviceId = await getDeviceId();
  
  const response = await fetch(`${BASE_URL}/auth.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      device_id: deviceId,
      device_name: navigator.userAgent.substring(0, 50),
    }),
  });

  if (!response.ok) throw new Error(`CMS Error: ${response.status}`);
  
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message || 'INVALID TOKEN');
  
  return data;
};

// ============================================================================
// CHECK SUBSCRIPTION — Verify token is still active
// ============================================================================
export const checkSubscription = async (token) => {
  const response = await fetch(`${BASE_URL}/check_subscription.php?token=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error(`Check failed: ${response.status}`);
  return response.json();
};

// ============================================================================
// REGISTER DEVICE — Anti-fraud device slot
// ============================================================================
export const registerDevice = async (token) => {
  const deviceId = await getDeviceId();

  const response = await fetch(`${BASE_URL}/register_device.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, device_id: deviceId }),
  });

  if (!response.ok) throw new Error(`Register failed: ${response.status}`);
  return response.json();
};

export { getDeviceId };

const NinjaAPI = { authWithToken, checkSubscription, registerDevice, getDeviceId };
export default NinjaAPI;
