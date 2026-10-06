// Capture d'écran rapide : npx tsx scripts/shot.ts /chemin sortie.png [mobile] [fullpage] [phone mdp]
import { chromium } from "playwright-core";
const [path, out, ...flags] = process.argv.slice(2);
const mobile = flags.includes("mobile");
const full = flags.includes("full");
const login = flags.find((f) => f.startsWith("login="))?.slice(6);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  if (login) {
    const [phone, pw] = login.split(":");
    await page.goto("http://localhost:3000/connexion");
    await page.fill('input[name="phone"]', phone); await page.fill('input[name="password"]', pw);
    await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 15000 });
  }
  await page.goto("http://localhost:3000" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out, fullPage: full });
  console.log("console errors:", errors.length ? errors : "none");
  await b.close();
})();
