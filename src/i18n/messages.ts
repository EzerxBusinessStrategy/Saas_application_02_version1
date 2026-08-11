import type { AbstractIntlMessages } from "next-intl";
import bn from "../../messages/bn.json";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import or from "../../messages/or.json";
import type { AppLocale } from "./config";

const messages: Record<AppLocale, AbstractIntlMessages> = { en, bn, hi, or };

export function getMessagesForLocale(locale: AppLocale): AbstractIntlMessages {
  return messages[locale];
}
