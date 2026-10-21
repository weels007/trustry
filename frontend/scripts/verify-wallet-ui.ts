/**
 * Drives the real interface in a browser with a fake MetaMask and a fake
 * Rabby injected at the same time, and checks that only the wallet the
 * person picks is ever asked for permission.
 *
 * The fake wallets are injected as plain text, because a function would be
 * transformed on the way in and would not run in the page.
 *
 * Two situations are covered:
 *   - both wallets publish themselves, MetaMask keeping the array
 *   - Rabby arrives later and replaces `window.ethereum` entirely, which is
 *     what hides MetaMask in a real browser
 */
import { chromium } from "playwright";

const BOTH_PUBLISHED = `
window.__calls = [];
(function () {
  function make(name, flags) {
    var provider = {};
    Object.keys(flags).forEach(function (key) { provider[key] = flags[key]; });
    provider.request = function (args) {
      window.__calls.push(name + ':' + args.method);
      if (args.method === 'eth_accounts') return Promise.resolve([]);
      if (args.method === 'eth_chainId') return Promise.resolve('0xf22f');
      if (args.method === 'eth_requestAccounts') {
        return Promise.resolve(['0xE8b3e800d08727D25156a44cD1609F793bd0Af5a']);
      }
      return Promise.resolve(null);
    };
    provider.on = function () {};
    provider.removeListener = function () {};
    return provider;
  }
  var metamask = make('metamask', { isMetaMask: true });
  var rabby = make('rabby', { isRabby: true, isMetaMask: true });
  metamask.providers = [metamask, rabby];
  window.ethereum = metamask;
})();
`;

/** Rabby loads later and replaces the global, so MetaMask is only in the early capture. */
const RABBY_TAKES_OVER = `
window.__calls = [];
(function () {
  function make(name, flags) {
    var provider = {};
    Object.keys(flags).forEach(function (key) { provider[key] = flags[key]; });
    provider.request = function (args) {
      window.__calls.push(name + ':' + args.method);
      if (args.method === 'eth_accounts') return Promise.resolve([]);
      if (args.method === 'eth_chainId') return Promise.resolve('0xf22f');
      if (args.method === 'eth_requestAccounts') {
        return Promise.resolve(['0xE8b3e800d08727D25156a44cD1609F793bd0Af5a']);
      }
      return Promise.resolve(null);
    };
    provider.on = function () {};
    provider.removeListener = function () {};
    return provider;
  }
  // MetaMask is there first, the way a real extension injects.
  var metamask = make('metamask', { isMetaMask: true });
  window.ethereum = metamask;

  // Then Rabby takes the global for itself, and MetaMask is only left in
  // the early capture the page made.
  setTimeout(function () {
    var rabby = make('rabby', { isRabby: true, isMetaMask: true });
    window.ethereum = rabby;
  }, 50);
})();
`;

async function runCase(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  name: string,
  script: string,
) {
  console.log(`\n${name}`);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript({ content: script });
  await page.goto("http://localhost:3000/notarize", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const injected = await page.evaluate(
    () => Boolean((window as unknown as { ethereum?: unknown }).ethereum),
  );
  console.log(`  ${injected ? "OK  " : "FAIL"} a wallet was injected`);

  // Open the picker.
  await page.getByRole("button", { name: /Connect/i }).first().click();
  await page.waitForTimeout(600);

  const body = await page.textContent("body");
  const seesMetaMask = (body ?? "").includes("MetaMask");
  const seesRabby = (body ?? "").includes("Rabby");
  console.log(`  ${seesMetaMask ? "OK  " : "FAIL"} the picker lists MetaMask`);
  console.log(`  ${seesRabby ? "OK  " : "FAIL"} the picker lists Rabby`);

  await page.screenshot({ path: `shots/wallet-picker-${name}.png` });

  // Choose Rabby.
  await page.getByRole("button", { name: /Rabby/ }).click();
  await page.waitForTimeout(1800);

  const calls = (await page.evaluate(
    () => (window as unknown as { __calls: string[] }).__calls,
  )) as string[];

  const requested = calls.filter((call) => call.endsWith(":eth_requestAccounts"));
  console.log(`  requestAccounts calls: ${JSON.stringify(requested)}`);
  console.log(
    `  ${requested.length === 1 ? "OK  " : "FAIL"} exactly one wallet was asked for permission`,
  );
  console.log(
    `  ${requested[0]?.startsWith("rabby") ? "OK  " : "FAIL"} it was the wallet that was picked`,
  );

  const connected = await page.textContent("body");
  const showsAddress = (connected ?? "").includes("0xE8b3...Af5a");
  console.log(`  ${showsAddress ? "OK  " : "FAIL"} the connected address is shown`);

  await page.screenshot({ path: `shots/wallet-${name}.png` });
  await page.close();

  return (
    injected &&
    seesMetaMask &&
    seesRabby &&
    requested.length === 1 &&
    requested[0]?.startsWith("rabby") &&
    showsAddress
  );
}

async function main() {
  const browser = await chromium.launch();

  const first = await runCase(browser, "both published", BOTH_PUBLISHED);
  const second = await runCase(browser, "rabby takes over", RABBY_TAKES_OVER);

  await browser.close();
  const passed = first && second;
  console.log(passed ? "\nthe wallet picker behaves" : "\nthe wallet picker did not behave");
  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
