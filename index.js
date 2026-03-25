const axios = require("axios");

async function test() {
  await axios.post(process.env.WEBHOOK_URL, {
    content: "✅ Pokemon monitor is working!"
  });
}

test();
