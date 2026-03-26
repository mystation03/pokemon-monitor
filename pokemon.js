const axios = require("axios");
const fs = require("fs");

function loadCache() {
  if (!fs.existsSync("cache.json")) return {};
  return JSON.parse(fs.readFileSync("cache.json"));
}

function saveCache(data) {
  fs.writeFileSync("cache.json", JSON.stringify(data));
}

async function monitor() {
  const cache = loadCache();

  const res = await axios.get("https://www.pokemoncenter.com", {
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const body = typeof res.data === "string" ? res.data.toLowerCase() : "";

  let state = "normal";

  if (
    res.status === 403 ||
    res.status === 503 ||
    body.includes("checking your browser") ||
    body.includes("cf-challenge")
  ) state = "security";

  else if (
    body.includes("queue") ||
    body.includes("waiting room")
  ) state = "queue";

  const prev = cache.pc || "normal";

  if (state !== prev) {
    let msg = "";

    if (state === "queue") msg = "⏳ Pokémon Center QUEUE";
    if (state === "security") msg = "🔒 Pokémon Center SECURITY";
    if (state === "normal") msg = "✅ Pokémon Center NORMAL";

    await axios.post(process.env.WEBHOOK_URL, {
      content: "@everyone",
      embeds: [
        {
          title: msg,
          color: state === "security" ? 16711680 : 16776960,
          timestamp: new Date()
        }
      ]
    });
  }

  cache.pc = state;
  saveCache(cache);
}

monitor();
