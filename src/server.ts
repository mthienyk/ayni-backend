import "dotenv/config";
import { buildApp } from "./app.js";
import { closeDatabase } from "./db/index.js";
import { env } from "./lib/config.js";

async function main(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
    await app.close();
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Ayni API listening on port ${env.PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
