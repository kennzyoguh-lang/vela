// Stable per-browser identifier for phone+PIN trust-on-first-use device
// binding (staff-auth.service.ts#loginWithPin) — generated once and
// persisted, no server round-trip needed to obtain it. Deliberately a
// locally-generated random token, not a hardware fingerprint (unreliable
// and privacy-invasive) — this is the same "linked device" concept most
// consumer apps use, just simpler.
const DEVICE_ID_KEY = "vela-pos-device-id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}
