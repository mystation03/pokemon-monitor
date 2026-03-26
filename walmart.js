const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const SEARCH_URL = "https://www.walmart.ca/search?q=pokemon+tcg";

function loadCache() {
  if (!fs.existsSync("cache.json")) return {};
  return JSON.parse(fs.readFileSync("cache.json"));
}

function saveCache(data) {
  fs.writeFileSync("cache.json", JSON.stringify(data));
}

async function sendDiscord(product) {
  await axios.post(process.env.WEBHOOK_URL, {
    content: "@everyone",
    embeds: [
      {
        title: product.name,
        url: product.url,
        color: 3066993,
        thumbnail: {
          url: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Walmart_logo.svg"
        },
        fields: [
          { name: "💰 Price", value: `$${product.price || "N/A"}`, inline: true },
          { name: "🏪 Store", value: "Walmart Canada", inline: true },
          { name: "📦 Status", value: "IN STOCK", inline: true }
        ],
        image: { url: product.image },
        footer: { text: "Pokemon Monitor" },
        timestamp: new Date()
      }
    ]
  });
}

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

async function checkProduct(id) {
  try {
    const res = await axios.get(
      `https://www.walmart.ca/api/product-page/v2/${id}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const data = res.data;

    if (
      !data?.sellerDisplayName ||
      !data.sellerDisplayName.toLowerCase().includes("walmart")
    ) return null;

    const fallbackStock =
      data?.addToCart?.buttonState === "ENABLED";

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

async function monitorWalmart() {
  const cache = loadCache();

  for (let i = 0; i < 6; i++) {
    const ids = await getProductIds();

    await Promise.all(ids.map(async (id) => {
      const product = await checkProduct(id);
      if (!product) return;

      const name = product.name.toLowerCase();

      // 🔥 RATTLE FILTER
      if (
        !name.includes("elite trainer") &&
        !name.includes("etb") &&
        !name.includes("ultra premium") &&
        !name.includes("booster box")
      ) return;

      const prev = cache[id];
      const isInStock = ["IN_STOCK", "AVAILABLE", "LIMITED_STOCK"].includes(product.status);

      if (cache[id] === "ALERTED") return;

      if (!prev && isInStock) {
        await sendDiscord(product);
        cache[id] = "ALERTED";
      }

      if (
        prev &&
        !["IN_STOCK", "AVAILABLE", "LIMITED_STOCK"].includes(prev) &&
        isInStock
      ) {
        await sendDiscord(product);
        cache[id] = "ALERTED";
      }

      cache[id] = product.status;
    }));

    await new Promise(res => setTimeout(res, 2000));
  }

  saveCache(cache);
}

monitorWalmart();
