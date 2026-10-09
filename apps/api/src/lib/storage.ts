import { createClient } from "@supabase/supabase-js";
import { badRequest } from "./errors.js";

const BUCKET = "barber-photos";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw badRequest(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы",
      "STORAGE_NOT_CONFIGURED",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function uploadPublicImage(
  path: string,
  bytes: Buffer,
  contentType: string,
) {
  const supabase = getClient();
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {
    // bucket may already exist
  });

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw badRequest(`Ошибка загрузки: ${error.message}`, "UPLOAD_FAILED");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
