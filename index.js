const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const SEARCH_URL = "https://www.walmart.ca/search?q=pokemon+tcg";

async function sendDiscord(product) {
  await axios.post(process.env.WEBHOOK_URL, {
    embeds: [
      {
        title: product.name,
        url: product.url,
        description: "🆕 Pokémon TCG Product Detected",
        image: {
          url: product.image
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

async function monitorWalmart() {
  const cache = loadCache();

  try {
    const res = await axios.get(SEARCH_URL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(res.data);

    const products = [];

    $("a").each((i, el) => {
      const href = $(el).attr("href");

      if (href && href.includes("/ip/")) {
        const fullUrl = "https://www.walmart.ca" + href;

        const name = $(el).text().trim();

        const image =
          $(el).find("img").attr("src") ||
          $(el).find("img").attr("data-src");

        const id = href.split("/ip/")[1];

        if (name && image) {
          products.push({
            id,
            name,
            url: fullUrl,
            image
          });
        }
      }
    });

    for (const p of products) {
      if (!cache[p.id]) {
        cache[p.id] = true;

        await sendDiscord(p);
      }
    }

    saveCache(cache);

  } catch (err) {
    console.log("Error:", err.message);
  }
}

monitorWalmart();
