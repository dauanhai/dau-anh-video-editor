import { ensureBrowser } from "@remotion/renderer";
const browser = await ensureBrowser();
if ("path" in browser) console.log(browser.path);
else throw new Error("Browser unavailable");
