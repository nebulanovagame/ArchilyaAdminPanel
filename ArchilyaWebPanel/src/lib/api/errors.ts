import { NextResponse } from "next/server";

type ApiErrorStatus = 400 | 401 | 402 | 403 | 404 | 409 | 500;

type StatusError = Error & {
  status: number;
};

export type MappedApiError = {
  message: string;
  status: ApiErrorStatus;
};

export type MapApiErrorOptions = {
  defaultMessage?: string;
  authMessage?: string;
  permissionMessage?: string;
  validationMessage?: string;
  paymentMessage?: string;
  backendMessage?: string;
};

export class BackendCallableError extends Error {
  readonly callableName: string;
  readonly code: string | null;

  constructor(callableName: string, message: string, code?: string | null) {
    super(message);
    this.name = "BackendCallableError";
    this.callableName = callableName;
    this.code = code ?? null;
  }
}

const DEFAULT_MESSAGES = {
  auth: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.",
  permission: "Bu işlem için yetkiniz bulunmuyor.",
  validation: "İstek verileri doğrulanamadı.",
  payment: "Bu işlem için yeterli krediniz bulunmuyor.",
  notFound: "İstenen kayıt bulunamadı.",
  conflict: "İşlem mevcut durum nedeniyle tamamlanamadı. Lütfen tekrar deneyin.",
  backend: "Sunucu işlemi tamamlanamadı. Lütfen tekrar deneyin.",
  unexpected: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
} as const;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isStatusError(error: unknown): error is StatusError {
  return error instanceof Error
    && "status" in error
    && typeof (error as { status?: unknown }).status === "number";
}

function isBackendCallableError(error: unknown): error is BackendCallableError {
  return error instanceof BackendCallableError;
}

function hasAnyNeedle(value: string, needles: readonly string[]) {
  return needles.some((needle) => value.includes(needle));
}

function isConfigurationFailure(message: string) {
  return hasAnyNeedle(message, [
    "panel_session_secret",
    "ortam degiskeni",
    "environment variable",
  ]);
}

function isAuthFailure(message: string, code: string) {
  return code === "unauthenticated"
    || code === "unauthorized"
    || hasAnyNeedle(message, [
      "oturum bulunamadi",
      "oturum acmaniz gerekiyor",
      "giris yapmaniz gerekiyor",
      "supabase kimlik bilgisi eksik",
      "supabase kimligi dogrulanamadi",
      "session ve supabase kullanicilari eslesmiyor",
      "jwt",
      "access token",
      "unauthenticated",
      "unauthorized",
    ]);
}

function isPermissionFailure(message: string, code: string) {
  return code === "permission-denied"
    || code === "permission_denied"
    || code === "forbidden"
    || hasAnyNeedle(message, [
      "yetki",
      "yetkiniz",
      "erisime yetki",
      "erisim yetkisi",
      "permission-denied",
      "permission denied",
      "forbidden",
    ]);
}

function isValidationFailure(message: string, code: string) {
  return code === "invalid-argument"
    || code === "invalid_argument"
    || hasAnyNeedle(message, [
      "dogrulama hatasi",
      "gecersiz istek",
      "invalid argument",
      "invalid-argument",
      "bad request",
    ]);
}

function isCreditInsufficientFailure(message: string) {
  return hasAnyNeedle(message, [
    "yetersiz kredi",
    "yeterli kredi yok",
    "kredi yetersiz",
    "havuzunda yeterli kredi yok",
    "yetersiz havuz kotasi",
    "insufficient credit",
    "not enough credit",
  ]);
}

function mapStatusError(error: StatusError, options: MapApiErrorOptions): MappedApiError {
  switch (error.status) {
    case 400:
      return { message: options.validationMessage ?? DEFAULT_MESSAGES.validation, status: 400 };
    case 401:
      return { message: options.authMessage ?? DEFAULT_MESSAGES.auth, status: 401 };
    case 402:
      return { message: options.paymentMessage ?? DEFAULT_MESSAGES.payment, status: 402 };
    case 403:
      return { message: options.permissionMessage ?? DEFAULT_MESSAGES.permission, status: 403 };
    case 404:
      return { message: DEFAULT_MESSAGES.notFound, status: 404 };
    case 409:
      return { message: DEFAULT_MESSAGES.conflict, status: 409 };
    default:
      return { message: options.defaultMessage ?? DEFAULT_MESSAGES.unexpected, status: 500 };
  }
}

export function mapApiError(error: unknown, options: MapApiErrorOptions = {}): MappedApiError {
  if (isStatusError(error)) {
    return mapStatusError(error, options);
  }

  const message = normalizeForMatch(getErrorMessage(error));
  const code = isBackendCallableError(error) && error.code
    ? normalizeForMatch(error.code.replace(/_/g, "-"))
    : "";

  if (isConfigurationFailure(message)) {
    return { message: options.defaultMessage ?? DEFAULT_MESSAGES.unexpected, status: 500 };
  }

  if (isAuthFailure(message, code)) {
    return { message: options.authMessage ?? DEFAULT_MESSAGES.auth, status: 401 };
  }

  if (isPermissionFailure(message, code)) {
    return { message: options.permissionMessage ?? DEFAULT_MESSAGES.permission, status: 403 };
  }

  if (isCreditInsufficientFailure(message)) {
    return { message: options.paymentMessage ?? DEFAULT_MESSAGES.payment, status: 402 };
  }

  if (isValidationFailure(message, code)) {
    return { message: options.validationMessage ?? DEFAULT_MESSAGES.validation, status: 400 };
  }

  if (isBackendCallableError(error)) {
    return { message: options.backendMessage ?? DEFAULT_MESSAGES.backend, status: 500 };
  }

  return { message: options.defaultMessage ?? DEFAULT_MESSAGES.unexpected, status: 500 };
}

export function apiErrorResponse(error: unknown, options?: MapApiErrorOptions) {
  const mappedError = mapApiError(error, options);

  return NextResponse.json(
    { error: mappedError.message },
    { status: mappedError.status },
  );
}
