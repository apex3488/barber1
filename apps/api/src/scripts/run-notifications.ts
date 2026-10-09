import { config } from "dotenv";
import { resolve } from "node:path";
import { runNotificationsJob } from "../jobs/notifications.js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const summary = await runNotificationsJob();
console.log(JSON.stringify({ ok: true, summary }, null, 2));
