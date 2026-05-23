import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

import {
  buildAuthRedirectHref,
  PANEL_LAST_PATH_COOKIE_NAME,
} from "@/lib/auth/redirect";

export const SESSION_COOKIE_NAME = "archilya_panel_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;

const PANEL_SESSION_TYPE = "archilya-panel-session";
const PANEL_SESSION_ISSUER = "archilya-panel";
const PANEL_SESSION_AUDIENCE = "archilya-panel-user";
const FIREBASE_ID_TOKEN_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
};

type SessionCookiePayload = {
  type: string;
  uid: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  emailVerified?: boolean;
};

function getFirebaseProjectId(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

  if (!projectId) {
    console.warn("[session] NEXT_PUBLIC_FIREBASE_PROJECT_ID eksik.");
  }

  return projectId || "demo-project";
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.PANEL_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "PANEL_SESSION_SECRET ortam değişkeni tanımlı değil. " +
        "Lütfen .env.local dosyasına PANEL_SESSION_SECRET=<güçlü-bir-şifre> ekleyin."
    );
  }

  return new TextEncoder().encode(secret);
}

function toSessionUser(decodedToken: {
  uid: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  email_verified?: boolean;
}): SessionUser {
  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    name: decodedToken.name ?? null,
    picture: decodedToken.picture ?? null,
    emailVerified: decodedToken.email_verified ?? false,
  };
}

function toSessionUserFromPayload(
  payload: SessionCookiePayload,
): SessionUser {
  return {
    uid: payload.uid,
    email: payload.email ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    emailVerified: Boolean(payload.emailVerified),
  };
}

export async function verifyFirebaseIdToken(idToken: string) {
  const projectId = getFirebaseProjectId();
  const { payload } = await jwtVerify(idToken, FIREBASE_ID_TOKEN_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  if (!payload.sub) {
    throw new Error("Firebase ID token geçersiz.");
  }

  return toSessionUser({
    uid: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
    email_verified: Boolean(payload.email_verified),
  });
}

export async function createSessionCookieValue(idToken: string) {
  const sessionUser = await verifyFirebaseIdToken(idToken);

  return new SignJWT({
    type: PANEL_SESSION_TYPE,
    uid: sessionUser.uid,
    email: sessionUser.email,
    name: sessionUser.name,
    picture: sessionUser.picture,
    emailVerified: sessionUser.emailVerified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(PANEL_SESSION_ISSUER)
    .setAudience(PANEL_SESSION_AUDIENCE)
    .setExpirationTime(
      Math.floor(Date.now() / 1000) + Math.floor(SESSION_DURATION_MS / 1000),
    )
    .sign(getSessionSecret());
}

export async function getSessionCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
}

export async function getOptionalSessionUser() {
  try {
    const sessionCookie = await getSessionCookieValue();

    if (!sessionCookie) {
      return null;
    }

    const { payload } = await jwtVerify(sessionCookie, getSessionSecret(), {
      issuer: PANEL_SESSION_ISSUER,
      audience: PANEL_SESSION_AUDIENCE,
    });

    if (payload.type !== PANEL_SESSION_TYPE || typeof payload.uid !== "string") {
      return null;
    }

    return toSessionUserFromPayload(payload as unknown as SessionCookiePayload);
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const sessionUser = await getOptionalSessionUser();

  if (!sessionUser) {
    const cookieStore = await cookies();
    const lastPanelPath = cookieStore.get(PANEL_LAST_PATH_COOKIE_NAME)?.value;

    redirect(buildAuthRedirectHref(lastPanelPath));
  }

  return sessionUser;
}
