// Shared data layer + pricing for catalog and admin pages.
(function () {
  const CFG = window.GOLD_CONFIG || {};
  const DEMO = !CFG.SUPABASE_URL;
  const sb = DEMO ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  const OUNCE_GRAMS = 31.1034768;

  const CATEGORIES = {
    necklace: "عقد",
    ring: "خاتم",
    set: "طقم",
    bracelet: "إسوارة",
    earrings: "حلق",
    other: "أخرى",
  };
  const KARATS = [24, 22, 21, 18];

  const DEFAULT_SETTINGS = {
    markup: 500, use_manual: false, manual_price_24k: null,
    last_price_24k: null, last_price_at: null, whatsapp: "", shop_name: "مجوهرات الذهب",
  };

  // ---------- demo (localStorage) backend ----------
  const LS = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { alert("مساحة التخزين ممتلئة"); throw e; } },
  };

  const db = {
    demo: DEMO,
    async getSettings() {
      if (DEMO) return { ...DEFAULT_SETTINGS, ...LS.get("gold_settings", {}) };
      const { data, error } = await sb.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return { ...DEFAULT_SETTINGS, ...data };
    },
    async saveSettings(patch) {
      if (DEMO) { LS.set("gold_settings", { ...LS.get("gold_settings", {}), ...patch }); return; }
      const { error } = await sb.from("settings").update(patch).eq("id", 1);
      if (error) throw error;
    },
    async listItems() {
      if (DEMO) return LS.get("gold_items", []).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data, error } = await sb.from("items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async saveItem(item) {
      if (DEMO) {
        const items = LS.get("gold_items", []);
        if (item.id) {
          const i = items.findIndex((x) => x.id === item.id);
          items[i] = { ...items[i], ...item };
        } else {
          items.push({ ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() });
        }
        LS.set("gold_items", items);
        return;
      }
      const { id, created_at, ...row } = item;
      const q = id ? sb.from("items").update(row).eq("id", id) : sb.from("items").insert(row);
      const { error } = await q;
      if (error) throw error;
    },
    async deleteItem(id) {
      if (DEMO) { LS.set("gold_items", LS.get("gold_items", []).filter((x) => x.id !== id)); return; }
      const { error } = await sb.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    async uploadPhoto(file) {
      const blob = DEMO ? await compressImage(file, 900, 0.72) : await compressImage(file);
      if (DEMO) return await blobToDataURL(blob);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from("items").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      return sb.storage.from("items").getPublicUrl(path).data.publicUrl;
    },
    // auth
    async session() { return DEMO ? { demo: true } : (await sb.auth.getSession()).data.session; },
    async signIn(email, password) {
      if (DEMO) return;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() { if (!DEMO) await sb.auth.signOut(); },
  };

  // ---------- images ----------
  function compressImage(file, max = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("image"))), "image/jpeg", quality);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  function blobToDataURL(blob) {
    return new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
  }

  // ---------- gold price ----------
  // Returns { price24: QR per gram of 24K, source, at }
  async function fetchSpot24() {
    const res = await fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" });
    if (!res.ok) throw new Error("price " + res.status);
    const j = await res.json();
    const usdOz = Number(j.price);
    if (!usdOz || usdOz < 500) throw new Error("bad price");
    return (usdOz * (CFG.USD_TO_QAR || 3.64)) / OUNCE_GRAMS;
  }

  async function getGoldPrice(settings) {
    if (settings.use_manual && settings.manual_price_24k) {
      return { price24: Number(settings.manual_price_24k), source: "manual", at: null };
    }
    try {
      const price24 = await fetchSpot24();
      return { price24, source: "live", at: new Date().toISOString() };
    } catch (e) {
      if (settings.last_price_24k) {
        return { price24: Number(settings.last_price_24k), source: "saved", at: settings.last_price_at };
      }
      return { price24: null, source: "none", at: null };
    }
  }

  function gramPrice(price24, karat) { return price24 * (karat / 24); }

  function finalPrice(item, price24, settings) {
    if (!price24) return null;
    const fee = item.extra_fee != null && item.extra_fee !== "" ? Number(item.extra_fee) : Number(settings.markup || 0);
    return Math.round(Number(item.grams) * gramPrice(price24, item.karat) + fee);
  }

  const fmt = (n, d = 0) =>
    n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const qr = (n) => (n == null ? "—" : fmt(n) + " ر.ق");

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.Gold = { db, CATEGORIES, KARATS, getGoldPrice, gramPrice, finalPrice, fmt, qr, esc };
})();
