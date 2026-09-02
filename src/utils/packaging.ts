export const PACKAGING = {
  "p-basic": { name_ar: "عادي", name_en: "Basic", extra: 0 },
  "p-classic": { name_ar: "كلاسيكي", name_en: "Classic", extra: 20000 },
  "p-royal": { name_ar: "ملكي", name_en: "Royal", extra: 45000 },
} as const;

export type PackagingId = keyof typeof PACKAGING;

export function isPackagingId(value: unknown): value is PackagingId {
  return typeof value === "string" && value in PACKAGING;
}

export function packagingExtra(id?: string | null): number {
  if (!isPackagingId(id)) return 0;
  return PACKAGING[id].extra;
}

export function packagingLabel(id?: string | null, locale: "ar" | "en" = "ar") {
  if (!isPackagingId(id)) return null;
  const row = PACKAGING[id];
  return locale === "en" ? row.name_en : row.name_ar;
}
