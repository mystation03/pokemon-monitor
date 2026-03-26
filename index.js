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
    const fallbackStock =
  data?.addToCart?.buttonState === "ENABLED";

// 🔥 FILTER: Only Walmart (not third-party sellers)
if (
  !data?.sellerDisplayName ||
  !data.sellerDisplayName.toLowerCase().includes("walmart")
) {
  return null;
}

return {
  id,
  name: data?.name,
  price: data?.priceInfo?.currentPrice?.price,
  image: data?.imageInfo?.thumbnailUrl,
  status: fallbackStock ? "IN_STOCK" : data?.availabilityStatus,
  url: `https://www.walmart.ca/en/ip/${id}`
};

  } catch {
    return null;
  }
}
console.log("Walmart monitor started");

async function monitorWalmart() {
  const cache = loadCache();

  // 🔁 run multiple quick checks
  for (let i = 0; i < 3; i++) {
    console.log(`Walmart check ${i + 1}`);

    const ids = await getProductIds();

    await Promise.all(ids.map(async (id) => {
      const product = await checkProduct(id);
      if (!product) return;

      const prev = cache[id];

      const isInStock = ["IN_STOCK", "AVAILABLE", "LIMITED_STOCK"].includes(product.status);

      // NEW product
      if (!prev && isInStock) {
        await sendDiscord(product);
      }

      // RESTOCK
      if (
        prev &&
        !["IN_STOCK", "AVAILABLE", "LIMITED_STOCK"].includes(prev) &&
        isInStock
      ) {
        await sendDiscord(product);
      }

      cache[id] = product.status;
    }));

    // ⏱️ wait ~5 seconds between checks
    await new Promise(res => setTimeout(res, 5000));
  }

  saveCache(cache);
}
console.log("Pokemon Center monitor running...");
async function monitorPokemonCenter(cache, saveCache) {
  try {
    const res = await axios.get("https://www.pokemoncenter.com", {
      validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const body = typeof res.data === "string" ? res.data.toLowerCase() : "";

    let state = "normal";

    // 🔒 High security detection
    if (
      res.status === 403 ||
      res.status === 503 ||
      body.includes("checking your browser") ||
      body.includes("cf-challenge") ||
      body.includes("attention required")
    ) {
      state = "security";
    }

    // ⏳ Queue detection
    else if (
      body.includes("queue") ||
      body.includes("line") ||
      body.includes("waiting room") ||
      body.includes("you are in line") ||
      body.includes("please wait")
    ) {
      state = "queue";
    }

    const prev = cache["pokemon_center"] || "normal";

    if (state !== prev) {

      if (state === "queue") {
        await axios.post(process.env.WEBHOOK_URL, {
          content: "@everyone",
          embeds: [
            {
              title: "⏳ Pokémon Center Queue",
              description: "Queue is live!",
              color: 16776960,
              footer: { text: "Pokemon Monitor" },
              timestamp: new Date()
            }
          ]
        });
      }

      if (state === "security") {
        await axios.post(process.env.WEBHOOK_URL, {
          content: "@everyone",
          embeds: [
            {
              title: "🔒 Pokémon Center High Security",
              description: "Cloudflare protection is active",
              color: 16711680,
              footer: { text: "Pokemon Monitor" },
              timestamp: new Date()
            }
          ]
        });
      }

      if (state === "normal") {
        await axios.post(process.env.WEBHOOK_URL, {
          embeds: [
            {
              title: "✅ Pokémon Center Normal",
              description: "Site is back to normal",
              color: 65280,
              footer: { text: "Pokemon Monitor" },
              timestamp: new Date()
            }
          ]
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

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0"
  });

  const page = await context.newPage();

  // 🚀 Block heavy stuff
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
      timeout: 15000
    });

    const html = await page.content();

    // 🔥 SIMPLE + RELIABLE DETECTION
    if (html.toLowerCase().includes("pokemon")) {

      const prev = cache["costco_pokemon"] || false;

      if (!prev) {
        await axios.post(process.env.WEBHOOK_URL, {
          content: "@everyone 🛒 Costco Pokémon products detected!\nhttps://www.costco.ca/CatalogSearch?keyword=pokemon"
        });
      }

      cache["costco_pokemon"] = true;
      saveCache(cache);
    }

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
