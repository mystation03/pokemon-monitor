const axios = require("axios");
const { chromium } = require("playwright");

const cache = {};

async function send(product) {
  await axios.post(process.env.WEBHOOK_URL, {
    content: "@everyone",
    embeds: [
      {
        title: `🔁 RESTOCK — ${product.name}`,
        url: product.url,
        color: 15158332,

        author: {
          name: "Costco Monitor",
          icon_url: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Costco_Wholesale_logo_2010-10-26.svg"
        },

        fields: [
          { name: "🏪 Store", value: "Costco CA", inline: true },
          { name: "📦 Status", value: "IN STOCK", inline: true }
        ],

        timestamp: new Date()
      }
    ]
  });
}

async function monitorCostco() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto("https://www.costco.ca/CatalogSearch?keyword=pokemon");

  const links = await page.$$eval("a[href*='/p/']", els =>
    els.map(e => ({ url: e.href, name: e.innerText }))
  );

  for (const p of links) {
    if (cache[p.url]) continue;

    await page.goto(p.url);

    const html = await page.content();

    const inStock =
      html.includes("Add to cart") ||
      html.includes("Ajouter au panier") ||
      html.includes("data-add-to-cart");

    if (inStock) {
      await send(p);
      cache[p.url] = true;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  await browser.close();
}

monitorCostco();
