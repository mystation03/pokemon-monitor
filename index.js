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
        color: 5763719, // blue

        fields: [
          {
            name: "💰 Price",
            value: `$${product.price || "N/A"}`,
            inline: true
          },
          {
            name: "🏪 Store",
            value: "Walmart CA",
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
          text: "Pokemon Monitor"
        }
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
if (!data?.sellerDisplayName?.includes("Walmart")) {
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

async function monitorWalmart() {
  const cache = loadCache();

  const ids = await getProductIds();

  await Promise.all(ids.map(async (id) => {}));
    const product = await checkProduct(id);
    if (!product) continue;

    const prev = cache[id];

    // FIRST TIME → store only
    if (!prev) {
      cache[id] = product.status;
      continue;
    }

    // 🔥 RESTOCK DETECTED
    if (prev !== "IN_STOCK" && product.status === "IN_STOCK") {
      await sendDiscord(product);
    }

    // update cache
    cache[id] = product.status;
  }

  saveCache(cache);
}

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

async function monitorCostco(cache, saveCache) {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0"
  });

  const page = await context.newPage();

  // 🔥 SPEED BOOST: block useless resources
  await page.route("**/*", route => {
    const type = route.request().resourceType();
    if (["image", "stylesheet", "font"].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    await page.goto(url, {
  waitUntil: "domcontentloaded",
  timeout: 10000
});

    const content = await page.content();

    // detect products
    if (content.includes("pokemon")) {
      if (!cache["costco_seen"]) {
        cache["costco_seen"] = true;

        await axios.post(process.env.WEBHOOK_URL, {
          content: "@everyone 🛒 Costco Pokémon product detected!"
        });
      }
    }

    saveCache(cache);

  } catch (err) {
    console.log("Costco error");
  }

  await browser.close();
}
((async () => {
  const cache = loadCache();

  await monitorWalmart();
  await monitorPokemonCenter(cache, saveCache);
  await monitorCostco(cache, saveCache);

})();
