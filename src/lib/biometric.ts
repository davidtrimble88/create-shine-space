import { Capacitor } from "@capacitor/core";
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";

const SERVER = "ltrvc.employee";
const ENABLED_KEY = "ltrvc.biometric.enabled";

export const isNative = () => Capacitor.isNativePlatform();

export const isBiometricEnabled = () =>
  typeof window !== "undefined" && localStorage.getItem(ENABLED_KEY) === "1";

export const setBiometricEnabled = (v: boolean) => {
  if (v) localStorage.setItem(ENABLED_KEY, "1");
  else localStorage.removeItem(ENABLED_KEY);
};

export async function biometricAvailable(): Promise<{
  available: boolean;
  type: BiometryType | null;
}> {
  if (!isNative()) return { available: false, type: null };
  try {
    const r = await NativeBiometric.isAvailable();
    return { available: r.isAvailable, type: r.biometryType ?? null };
  } catch {
    return { available: false, type: null };
  }
}

export async function saveCredentials(email: string, password: string) {
  if (!isNative()) return;
  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: SERVER,
  });
  setBiometricEnabled(true);
}

export async function clearCredentials() {
  setBiometricEnabled(false);
  if (!isNative()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {
    // no-op
  }
}

export async function verifyAndGetCredentials(reason = "Sign in to LTR") {
  if (!isNative()) throw new Error("Biometrics require the native app");
  await NativeBiometric.verifyIdentity({
    reason,
    title: "Face ID Sign In",
    subtitle: "Use Face ID to access your employee account",
  });
  return NativeBiometric.getCredentials({ server: SERVER });
}

export function biometryLabel(type: BiometryType | null): string {
  switch (type) {
    case BiometryType.FACE_ID:
      return "Face ID";
    case BiometryType.TOUCH_ID:
      return "Touch ID";
    case BiometryType.FACE_AUTHENTICATION:
      return "Face Unlock";
    case BiometryType.FINGERPRINT:
      return "Fingerprint";
    case BiometryType.IRIS_AUTHENTICATION:
      return "Iris";
    default:
      return "Biometrics";
  }
}
