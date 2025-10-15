export const locales = ["en", "de"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en";

export async function getMessages(locale: Locale) {
  switch (locale) {
    case "en":
      return (await import("@/messages/en.json")).default;
    case "de":
      return (await import("@/messages/de.json")).default;
    default:
      return (await import("@/messages/en.json")).default;
  }
}
