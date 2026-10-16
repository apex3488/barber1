import { config } from "dotenv";
import { resolve } from "node:path";
import Fastify from "fastify";
import { registerApp } from "./createApp.js";
import { setupBotMenu } from "./routes/telegram.js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const app = Fastify({
  logger: true,
});

await registerApp(app);

const port = Number(process.env.PORT ?? 3011);

// На Vercel нельзя await listen — модуль зависает и даёт INTERNAL_FUNCTION_INVOCATION_FAILED.
app
  .listen({ host: "0.0.0.0", port })
  .then(() => {
    app.log.info(`API listening on http://localhost:${port}`);
    void setupBotMenu().catch((error) => {
      app.log.error(error);
    });
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
