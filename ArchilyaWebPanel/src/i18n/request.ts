import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing } from "./routing";
import trMessages from "../../messages/tr.json";
import enMessages from "../../messages/en.json";

const messagesByLocale: Record<string, typeof trMessages> = {
  tr: trMessages,
  en: enMessages,
};

export default getRequestConfig(async () => {
  try {
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get("archilya-locale")?.value;
    const locale = routing.locales.includes(localeCookie as "tr" | "en")
      ? (localeCookie as "tr" | "en")
      : routing.defaultLocale;

    return {
      locale,
      messages: messagesByLocale[locale] ?? messagesByLocale.tr,
    };
  } catch {
    return {
      locale: routing.defaultLocale,
      messages: messagesByLocale.tr,
    };
  }
});
