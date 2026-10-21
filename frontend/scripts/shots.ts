import { chromium } from "playwright";

const PAGES = [
  { path: "/", name: "landing" },
  { path: "/notarize", name: "notarize" },
  { path: "/records", name: "records" },
  { path: "/how-it-works", name: "how-it-works" },
];

async function main() {
  const browser = await chromium.launch();

  for (const viewport of [
    { width: 1440, height: 960, tag: "desktop" },
    { width: 390, height: 844, tag: "mobile" },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    for (const target of PAGES) {
      await page.goto(`http://localhost:3000${target.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `shots/${target.name}-${viewport.tag}.png`,
        fullPage: false,
      });
      console.log(`shot: ${target.name}-${viewport.tag}`);
    }
    await page.close();
  }

  await browser.close();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
