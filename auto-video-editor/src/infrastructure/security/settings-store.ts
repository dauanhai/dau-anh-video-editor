import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "fontkit";
import {
  appSettingsSchema,
  defaultSettings,
  type AppSettings,
} from "../../domain/settings";
import { atomicJson, safeExisting } from "../filesystem/atomic-file";
export class SettingsStore {
  value: AppSettings = defaultSettings;
  constructor(private root: string) {}
  async load() {
    try {
      this.value = appSettingsSchema.parse(
        JSON.parse(await readFile(join(this.root, "settings.json"), "utf8")),
      );
    } catch {}
    return this.value;
  }
  async save(input: unknown) {
    const v = appSettingsSchema.parse(input);
    if (v.brand.logo)
      v.brand.logo = await safeExisting(this.root, v.brand.logo);
    if (v.brand.fontFile) {
      v.brand.fontFile = await safeExisting(this.root, v.brand.fontFile);
      const font = fontkit.openSync(v.brand.fontFile);
      if (!("hasGlyphForCodePoint" in font))
        throw new Error("FONT_COLLECTION_UNSUPPORTED");
      const vietnamese =
        "ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ";
      if (
        [...vietnamese].some(
          (c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!),
        )
      )
        throw new Error("FONT_MISSING_VIETNAMESE_GLYPHS");
    }
    await atomicJson(join(this.root, "settings.json"), v);
    this.value = v;
    return v;
  }
}
