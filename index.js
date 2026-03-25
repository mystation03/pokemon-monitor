const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const SEARCH_URL = "https://www.walmart.ca/search?q=pokemon+tcg";

async function sendDiscord(product) {
  await axios.post(process.env.WEBHOOK_URL, {
    content: "@everyone 🚨 RESTOCK",
    embeds: [
      {
        title: product.name,
        url: product.url,
        color: 3066993,

        fields: [
          {
            name: "💰 Price",
            value: `$${product.price || "N/A"}`,
            inline: true
          },
          {
            name: "🏪 Store",
            value: "Walmart Canada",
            inline: true
          },
          {
            name: "📦 Status",
            value: "IN STOCK",
            inline: true
          }
        ],

        image: {
          url: product.image
        },

        footer: {
          text: "Rattle-Style Monitor • GitHub System"
        },

        timestamp: new Date()
      }
    ]
  });
}

function loadCache() {
  if (!fs.existsSync("cache.json")) return {};
  return JSON.parse(fs.readFileSync("cache.json"));
}

function saveCache(data) {
  fs.writeFileSync("cache.json", JSON.stringify(data));
}

// 🔥 Extract product IDs from search page
async function getProductIds() {
  const res = await axios.get(SEARCH_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const $ = cheerio.load(res.data);
  const ids = [];

  $("a").each((i, el) => {
    const href = $(el).attr("href");

    if (href && href.includes("/ip/")) {
      const id = href.split("/ip/")[1];
      if (id) ids.push(id);
    }
  });

  return [...new Set(ids)];
}

// 🔥 Fetch product data from Walmart API
async function checkProduct(id) {
  try {
    const url = `https://www.walmart.ca/api/product-page/v2/${id}`;

    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

   const data = res.data;

// 🔥 FILTER: Only Walmart (not third-party sellers)
if (!data?.sellerDisplayName?.toLowerCase().includes("walmart")) {
  return null;
}

return {
  id,
  name: data?.name,
  price: data?.priceInfo?.currentPrice?.price,
  image: data?.imageInfo?.thumbnailUrl,
  status: data?.availabilityStatus,
  url: `https://www.walmart.ca/en/ip/${id}`
};

  } catch {
    return null;
  }
}
console.log("Walmart monitor started");

await axios.post(process.env.WEBHOOK_URL, {
  content: "🧪 TEST: Walmart monitor started"
});
console.log("Walmart monitor running...");
async function monitorWalmart() {
  const cache = loadCache();
  const ids = await getProductIds();

  await Promise.all(ids.map(async (id) => {
    const product = await checkProduct(id);
    if (!product) return;

    const prev = cache[id];

    // 🚨 FORCE TEST (safe)
    await sendDiscord(product);

    cache[id] = product.status;
  }));

  saveCache(cache);
}

console.log("Pokemon Center monitor running...");
async function monitorPokemonCenter(cache, saveCache) {
  try {
    const res = await axios.get("https://www.pokemoncenter.com", {
      validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const body = typeof res.data === "string" ? res.data : "";

    let state = "normal";

    if (res.status === 403 || res.status === 503 || body.includes("checking your browser")) {
      state = "security";
    } else if (body.includes("queue") || body.includes("line") || body.includes("waiting")) {
      state = "queue";
    }

    const prev = cache["pokemon_center"] || "normal";

    // 🔥 Only alert on change
    if (state !== prev) {
      if (state === "queue") {
        await axios.post(process.env.WEBHOOK_URL, {
          content: "@everyone ⏳ Pokémon Center QUEUE is live!"
        });
      }

      if (state === "security") {
        await axios.post(process.env.WEBHOOK_URL, {
          content: "@everyone 🔒 Pokémon Center HIGH SECURITY!"
        });
      }

      if (state === "normal") {
        await axios.post(process.env.WEBHOOK_URL, {
          content: "✅ Pokémon Center back to normal"
        });
      }
    }

    cache["pokemon_center"] = state;
    saveCache(cache);

  } catch (err) {
    console.log("Pokemon Center error");
  }
}

const { chromium } = require("playwright");

console.log("Costco monitor running...");
async function sendCostcoEmbed(product) {
  await axios.post(process.env.WEBHOOK_URL, {
    content: "@everyone 🚨 COSTCO RESTOCK",
    embeds: [
      {
        title: product.name || "Pokemon Product",
        url: product.url,
        color: 15158332,

        fields: [
          {
            name: "🏪 Store",
            value: "Costco Canada",
            inline: true
          },
          {
            name: "📦 Status",
            value: "IN STOCK",
            inline: true
          },
          {
            name: "⚡ Monitor",
            value: "Pokemon Restock",
            inline: true
          }
        ],

        thumbnail: {
          url: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Costco_Wholesale_logo_2010-10-26.svg"
        },

        footer: {
          text: "Rattle-Style Monitor • GitHub System"
        },

        timestamp: new Date()
      }
    ]
  });
}
async function monitorCostco(cache, saveCache) {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0"
  });

  const page = await context.newPage();

  // 🚀 SPEED: block heavy resources
  await page.route("**/*", route => {
    const type = route.request().resourceType();
    if (["image", "stylesheet", "font"].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    await page.goto("https://www.costco.ca/CatalogSearch?keyword=pokemon", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    // 🔥 Grab product cards
    const products = await page.$$eval("a[href*='/p/']", items =>
      items.map(el => ({
        url: el.href,
        name: el.innerText
      }))
    );

    for (const p of products) {
      const id = p.url;

      await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 10000 });

      const content = await page.content();

      // ✅ REAL STOCK CHECK
      const inStock =
        content.includes("Add to Cart") ||
        content.includes("Add to basket");

      const prev = cache[id] || "unknown";

      if (inStock && prev !== "instock") {
        await sendCostcoEmbed(p);
        cache[id] = "instock";
      } else if (!inStock) {
        cache[id] = "oos";
      }
    }

    saveCache(cache);

  } catch (err) {
    console.log("Costco error");
  }

  await browser.close();
}
  (async () => {
  const cache = loadCache();

  await monitorWalmart();
  await monitorPokemonCenter(cache, saveCache);
  await monitorCostco(cache, saveCache);

})();
