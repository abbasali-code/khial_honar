import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set(["https://abbasali-code.github.io"]);
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const encoder = new TextEncoder();

function response(body: unknown, status = 200, origin = "") {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Vary": "Origin",
    },
  });
}

async function hashIp(ip: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(ip)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (!allowedOrigins.has(origin)) return response({ error: "Origin not allowed" }, 403, origin);
  if (req.method === "OPTIONS") return response(null, 204, origin);
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, origin);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return response({ error: "JSON required" }, 415, origin);
  }

  const raw = await req.text();
  if (raw.length > 10_000) return response({ error: "درخواست بیش از حد بزرگ است." }, 413, origin);

  let data: Record<string, unknown>;
  try { data = JSON.parse(raw); }
  catch { return response({ error: "اطلاعات ارسالی معتبر نیست." }, 400, origin); }
  if (typeof data.website === "string" && data.website.trim() !== "") return response({ ok: true }, 200, origin);

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !anonKey || !serviceKey) {
    return response({ error: "سرویس ثبت درخواست فعلاً در دسترس نیست." }, 503, origin);
  }

  // Persistent, privacy-preserving IP rate limit. The raw IP is never stored.
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ip = forwarded.split(",")[0].trim();
  const ipHash = await hashIp(ip, serviceKey);
  const adminHeaders = { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const rateUrl = `${projectUrl}/rest/v1/academy_submission_attempts`;
  const rateInsert = await fetch(rateUrl, {
    method: "POST",
    headers: { ...adminHeaders, "Prefer": "return=minimal" },
    body: JSON.stringify({ ip_hash: ipHash }),
  });
  if (!rateInsert.ok) return response({ error: "سامانه بررسی درخواست‌ها موقتاً در دسترس نیست." }, 503, origin);

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const countUrl = new URL(rateUrl);
  countUrl.search = new URLSearchParams({ select: "id", ip_hash: "eq." + ipHash, attempted_at: "gte." + since }).toString();
  const countResponse = await fetch(countUrl, { headers: adminHeaders });
  if (!countResponse.ok) return response({ error: "سامانه بررسی درخواست‌ها موقتاً در دسترس نیست." }, 503, origin);
  const attempts = await countResponse.json();
  if (Array.isArray(attempts) && attempts.length > MAX_ATTEMPTS) {
    return response({ error: "تعداد درخواست‌ها زیاد است؛ ۱۵ دقیقه بعد دوباره تلاش کن." }, 429, origin);
  }

  // Keep the small rate-limit table tidy.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cleanupUrl = new URL(rateUrl);
  cleanupUrl.search = new URLSearchParams({ attempted_at: "lt." + cutoff }).toString();
  await fetch(cleanupUrl, { method: "DELETE", headers: adminHeaders }).catch(() => undefined);

  const fullName = String(data.full_name ?? "").trim();
  const email = String(data.email ?? "").trim().toLowerCase();
  const displayName = String(data.display_name ?? fullName).trim();
  const avatarUrl = String(data.avatar_url ?? "").trim();
  const avatarEmoji = String(data.avatar_emoji ?? "🎨").trim();
  const phone = String(data.phone ?? "").trim();
  const rubikaId = String(data.rubika_id ?? "").trim();
  const course = String(data.course ?? "").trim();
  const age = data.age === "" || data.age == null ? null : Number(data.age);
  const city = String(data.city ?? "").trim();
  const sampleWorkUrls = Array.isArray(data.sample_work_urls) ? data.sample_work_urls.map((value) => String(value ?? "").trim()) : [];
  const message = String(data.message ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return response({ error: "ایمیل معتبر نیست." }, 400, origin);
  if (fullName.length < 2 || fullName.length > 100) return response({ error: "نام باید بین ۲ تا ۱۰۰ نویسه باشد." }, 400, origin);
  if (displayName.length < 2 || displayName.length > 100) return response({ error: "نام نمایشی باید بین ۲ تا ۱۰۰ نویسه باشد." }, 400, origin);
  if (avatarUrl && (!(avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) || avatarUrl.length > 500)) return response({ error: "لینک تصویر پروفایل معتبر نیست." }, 400, origin);
  if (avatarEmoji.length > 16 || /[<>]/.test(avatarEmoji)) return response({ error: "ایموجی پروفایل معتبر نیست." }, 400, origin);
  if (!/^\+?[0-9][0-9 -]{7,17}$/.test(phone)) return response({ error: "شماره تلفن معتبر نیست." }, 400, origin);
  if (rubikaId.length < 2 || rubikaId.length > 80) return response({ error: "شناسه روبیکا معتبر نیست." }, 400, origin);
  if (!["طراحی", "نقاشی", "گرافیک", "هنر دیجیتال", "سایر"].includes(course)) return response({ error: "لطفاً دوره را درست انتخاب کن." }, 400, origin);
  if (age !== null && (!Number.isInteger(age) || age < 7 || age > 100)) return response({ error: "سن واردشده معتبر نیست." }, 400, origin);
  if (city.length > 80 || message.length > 1000) return response({ error: "بعضی از فیلدها بیش از حد طولانی هستند." }, 400, origin);
  if (sampleWorkUrls.length < 3 || sampleWorkUrls.length > 6 || sampleWorkUrls.some((url) => !/^https?:\/\//i.test(url) || url.length > 500) || new Set(sampleWorkUrls).size !== sampleWorkUrls.length) return response({ error: "ارسال حداقل سه لینک معتبر و متفاوت برای نمونه‌کار الزامی است." }, 400, origin);

  const dbResponse = await fetch(`${projectUrl}/rest/v1/academy_applications`, {
    method: "POST",
    headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({
      full_name: fullName, email, display_name: displayName, avatar_url: avatarUrl || null,
      avatar_emoji: avatarEmoji || "🎨", phone, rubika_id: rubikaId, age,
      city: city || null, course, sample_work_url: sampleWorkUrls[0], sample_work_urls: sampleWorkUrls, message: message || null,
    }),
  });
  if (!dbResponse.ok) {
    const detail = await dbResponse.text();
    if (dbResponse.status === 409 || detail.includes("academy_one_pending_application_per_phone")) {
      return response({ error: "با این شماره یک درخواست در حال بررسی وجود دارد." }, 409, origin);
    }
    return response({ error: "ثبت درخواست انجام نشد؛ لطفاً کمی بعد دوباره تلاش کن." }, 400, origin);
  }
  return response({ ok: true, message: "درخواستت با موفقیت ثبت شد." }, 201, origin);
});
