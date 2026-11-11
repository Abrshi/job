
import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error("Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env");
  }

  const client = new TelegramClient(
    new StringSession(""),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );

  console.log("Connecting to Telegram...");

  await client.start({
    phoneNumber: async () => input.text("Phone number (+251...): "),
    phoneCode: async () => input.text("Telegram verification code: "),
    password: async () => input.text("Two-step verification password: "),
    onError: (err) => console.error("Telegram error:", err),
  });

  const session = client.session.save();

  console.log("\nTelegram login successful!");
  console.log("\nYour TELEGRAM_SESSION value:\n");
  console.log(session);

  await client.disconnect();
}

main().catch((error) => {
  console.error("SESSION GENERATION FAILED:", error);
  process.exitCode = 1;
});
