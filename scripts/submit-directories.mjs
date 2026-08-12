// Recon + submit arb-dex-mcp to the web MCP directories over the persistent
// Chrome :9222 session (so we inherit whatever logins Donny already has).
// Usage: node scripts/submit-directories.mjs <url> [<url> ...]
import puppeteer from 'file:///C:/Users/donny/Documents/flywheel-cmd/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const targets = process.argv.slice(2);
const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
  defaultViewport: { width: 1440, height: 1000 },
});

for (const url of targets) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 4000));
    const slug = url.replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
    await page.screenshot({ path: `C:/Users/donny/Documents/arb-dex-mcp/.scratch/${slug}.png` });
    const info = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      // Everything a submission form could need us to know about.
      inputs: [...document.querySelectorAll('input,textarea,select')].map((el) => ({
        tag: el.tagName, type: el.type, name: el.name, id: el.id,
        placeholder: el.placeholder, label: el.labels?.[0]?.innerText?.slice(0, 60),
      })),
      buttons: [...document.querySelectorAll('button,a[href]')]
        .map((el) => (el.innerText || '').trim())
        .filter((t) => t && t.length < 40).slice(0, 60),
      bodyHead: document.body.innerText.slice(0, 900),
    }));
    console.log(JSON.stringify({ target: url, ...info }, null, 1));
  } catch (e) {
    console.log(JSON.stringify({ target: url, error: String(e).slice(0, 200) }));
  }
  console.log('\n=====================\n');
}
await browser.disconnect();
