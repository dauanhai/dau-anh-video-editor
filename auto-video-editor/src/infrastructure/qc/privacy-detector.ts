export function detectPrivacy(text: string) {
  const w: string[] = [];
  if (/hộ chiếu|passport|\b[A-Z]\d{7}\b/i.test(text))
    w.push("PERSONAL_DATA_PASSPORT");
  if (/\b(?:0|\+84)\d[\d .-]{7,12}\d\b/.test(text))
    w.push("PERSONAL_DATA_PHONE");
  if (/ngày sinh|sinh ngày|\b\d{2}[/-]\d{2}[/-]\d{4}\b/i.test(text))
    w.push("PERSONAL_DATA_BIRTHDATE");
  return w;
}
