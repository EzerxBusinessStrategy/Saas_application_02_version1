import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { appLocaleCookie, normalizeLocale } from "./config";
import { getMessagesForLocale } from "./messages";

export default getRequestConfig(async () => {
  const locale = normalizeLocale((await cookies()).get(appLocaleCookie)?.value);
  return { locale, messages: getMessagesForLocale(locale) };
});
