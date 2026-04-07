import type { LandingPageContent } from "@shared/landing-page-content";
import type { PublicNewsItem } from "./public-feed-cache";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Lucide-style inline SVG icons (match the app's lucide-react icons)
const SVG = {
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>`,
  palette: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
};

// Reliable Unsplash fallback images per feature slot
const UNSPLASH_FALLBACKS = [
  "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1400&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1675557009875-436f7a7c3d29?w=1400&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1400&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1400&q=85&auto=format&fit=crop",
];

// Escape single quotes for safe JS string embedding
function escJs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function generateLandingHtml(
  content: LandingPageContent,
  feeds?: { tech: PublicNewsItem[]; gaming: PublicNewsItem[]; top: PublicNewsItem[] },
): string {
  const { hero, about, features, seo } = content;

  // ── Time-ago helper ─────────────────────────────────────────────────────
  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return "منذ أقل من ساعة";
    if (h < 24) return `منذ ${h} ساعة`;
    const d = Math.floor(h / 24);
    if (d === 1) return "منذ يوم";
    if (d < 7) return `منذ ${d} أيام`;
    return `منذ ${Math.floor(d / 7)} أسابيع`;
  }

  // ── Live news section builder ────────────────────────────────────────────
  function buildNewsCards(items: PublicNewsItem[]): string {
    if (!items.length) return `<p class="pnf-empty">جارٍ تحديث الأخبار… يرجى المراجعة لاحقاً.</p>`;
    return items.map((item) => `
      <article class="pnf-card">
        ${item.imageUrl ? `<div class="pnf-img-wrap"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.arabicTitle)}" loading="lazy" class="pnf-img"/></div>` : ""}
        <div class="pnf-card-body">
          <div class="pnf-normal">
            <div class="pnf-source">${escapeHtml(item.sourceName)}</div>
            <h3 class="pnf-title">${escapeHtml(item.title)}</h3>
            <p class="pnf-summary">${escapeHtml(item.summary.slice(0, 180))}…</p>
          </div>
          <div class="pnf-smart" hidden>
            <span class="pnf-smart-badge">✦ فِكري</span>
            <h3 class="pnf-ar-title">${escapeHtml(item.arabicTitle)}</h3>
            <p class="pnf-ar-summary">${escapeHtml(item.arabicSummary.slice(0, 200))}…</p>
          </div>
          <footer class="pnf-meta">
            <span>${escapeHtml(item.sourceName)}</span>
            <span>${timeAgo(item.publishedAt)}</span>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">اقرأ المصدر ↗</a>
          </footer>
        </div>
      </article>`).join("");
  }

  const liveNewsHtml = `
  <!-- ══ LIVE NEWS ════════════════════════════════════════ -->
  <section class="pnf-section">
    <div class="pnf-inner">
      <div class="pnf-header">
        <span class="section-pill">📡 أخبار مباشرة</span>
        <h2>أحدث الأخبار العالمية</h2>
        <p>محتوى حقيقي من أبرز المصادر — اضغط <strong>عرض ذكي</strong> لترى الترجمة والتلخيص بالعربية.</p>
      </div>
      <div class="pnf-controls">
        <div class="pnf-tabs">
          <button class="pnf-tab active" data-tab="tech">⚡ التقنية</button>
          <button class="pnf-tab" data-tab="gaming">🎮 الألعاب</button>
          <button class="pnf-tab" data-tab="top">🌍 أبرز الأخبار</button>
        </div>
        <div class="pnf-view-toggle">
          <button class="pnf-view-btn active" id="pnfNormalBtn">عادي</button>
          <button class="pnf-view-btn" id="pnfSmartBtn">✦ ذكي (فِكري)</button>
        </div>
      </div>
      <div class="pnf-panel active" data-panel="tech">
        ${buildNewsCards(feeds?.tech ?? [])}
      </div>
      <div class="pnf-panel" data-panel="gaming">
        ${buildNewsCards(feeds?.gaming ?? [])}
      </div>
      <div class="pnf-panel" data-panel="top">
        ${buildNewsCards(feeds?.top ?? [])}
      </div>
    </div>
  </section>`;

  const howToUseHtml = `
  <!-- ══ HOW TO USE ═══════════════════════════════════════ -->
  <section class="howto-section">
    <div class="howto-inner">
      <div class="howto-header">
        <span class="section-pill">🚀 كيف تبدأ</span>
        <h2>كيف تستخدم نَسَق؟</h2>
      </div>
      <div class="howto-grid">
        <div class="howto-step">
          <div class="howto-num">١</div>
          <div class="howto-emoji">🗂️</div>
          <h3>أنشئ مجلداً</h3>
          <p>سجّل دخولك وأنشئ مجلداً لكل مجال يهمّك — تقنية، ألعاب، صحة، وأكثر.</p>
        </div>
        <div class="howto-step">
          <div class="howto-num">٢</div>
          <div class="howto-emoji">📡</div>
          <h3>أضف مصادرك</h3>
          <p>أضف روابط RSS أو قنوات يوتيوب أو استخدم الكاشف ليقترح عليك أفضل المصادر.</p>
        </div>
        <div class="howto-step">
          <div class="howto-num">٣</div>
          <div class="howto-emoji">✦</div>
          <h3>شغّل العرض الذكي</h3>
          <p>بضغطة واحدة يترجم فِكري المقال ويلخّصه بالعربية بجودة احترافية.</p>
        </div>
        <div class="howto-step">
          <div class="howto-num">٤</div>
          <div class="howto-emoji">💡</div>
          <h3>ولّد أفكاراً</h3>
          <p>وجّه فِكري لتوليد أفكار فيديوهات وسكريبتات جاهزة للتنفيذ فوراً.</p>
        </div>
      </div>
    </div>
  </section>`;


  const featuresHtml = features
    .map((f, idx) => {
      const imgSrc = f.imageUrl?.trim() || UNSPLASH_FALLBACKS[idx % UNSPLASH_FALLBACKS.length];
      return `
      <article class="feature-article">
        <div class="feature-text-glass">
          <span class="feature-emoji-large" aria-hidden="true">${escapeHtml(f.emoji)}</span>
          <div class="feature-text-body">
            <h3 class="feature-title">${escapeHtml(f.title)}</h3>
            <p class="feature-desc">${escapeHtml(f.description)}</p>
          </div>
        </div>
        <div class="feature-image-wrapper">
          <img
            src="${escapeHtml(imgSrc)}"
            alt="${escapeHtml(f.title)}"
            loading="lazy"
            decoding="async"
            class="feature-image"
          />
        </div>
      </article>`;
    })
    .join("");

  const sunIconJs = escJs(SVG.sun);
  const moonIconJs = escJs(SVG.moon);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-color-mode="light" data-app-theme="tech-field">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(seo.metaTitle)}</title>
  <meta name="description" content="${escapeHtml(seo.metaDescription)}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="${escapeHtml(seo.metaTitle)}" />
  <meta property="og:description" content="${escapeHtml(seo.metaDescription)}" />
  <meta property="og:type" content="website" />
  <meta name="theme-color" content="#fe90e8" />
  <meta name="google-adsense-account" content="ca-pub-6128644359275323" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6128644359275323" crossorigin="anonymous"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "نَسَق",
    "url": "https://nasaqapp.net",
    "description": "${escapeHtml(seo.metaDescription)}",
    "inLanguage": "ar",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://nasaqapp.net/?q={search_term_string}",
      "query-input": "required name=search_term_string"
    },
    "publisher": {
      "@type": "Organization",
      "name": "نَسَق",
      "url": "https://nasaqapp.net",
      "logo": { "@type": "ImageObject", "url": "https://nasaqapp.net/logo.png" },
      "contactPoint": { "@type": "ContactPoint", "contactType": "customer support", "email": "hello@nasaqapp.net" }
    }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet" />

  <!-- Runs before paint — prevents FOUC and handles smart auth redirect -->
  <script>
    (function () {
      var cm = localStorage.getItem('nasaq-color-mode') || 'light';
      var th = localStorage.getItem('nasaq-accent') || 'tech-field';
      var html = document.documentElement;
      html.setAttribute('data-color-mode', cm);
      html.setAttribute('data-app-theme', th);
      if (cm === 'dark') html.classList.add('dark-mode');
      // Fast-path: authenticated users bypass the landing page instantly
      if (localStorage.getItem('nasaq-authed') === '1') {
        window.location.replace('/dashboard');
      }
    })();
  </script>

  <style>
    /* ═══════════════════════════════════════════
       RESET
       ═══════════════════════════════════════════ */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    img { display: block; max-width: 100%; }
    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; }

    /* ═══════════════════════════════════════════
       DESIGN TOKENS
       Mirrors the app's :root and [data-app-theme] vars exactly
       ═══════════════════════════════════════════ */
    :root {
      --font: 'Cairo', 'Tajawal', sans-serif;

      /* Hero gradient — Default: tech-field (Pink/Pulse) */
      --hero-a: #fe90e8;
      --hero-b: #f7cb46;
      --hero-c: #c0f7fe;

      /* Surface — Light mode */
      --bg:           hsl(38 28% 89%);
      --fg:           hsl(0 0% 8%);
      --card-bg:      hsl(40 20% 97%);
      --border-color: hsl(0 0% 12%);
      --muted-fg:     hsl(0 0% 35%);

      /* Neo-brutalist shadows */
      --nb-shadow:    10px 10px 0 0 rgba(0,0,0,0.92);
      --nb-shadow-md: 6px 6px 0 0 rgba(0,0,0,0.85);
      --nb-shadow-sm: 4px 4px 0 0 rgba(0,0,0,0.82);

      /* Body texture */
      --dot-color:    rgba(0,0,0,0.10);
      --stripe-color: rgba(0,0,0,0.05);

      /* Radii matching the app */
      --r-xl:   30px;
      --r-lg:   24px;
      --r-md:   16px;
      --r-pill: 50px;
    }

    /* ─── Theme: وهج (Gold/Yellow) ─── */
    html[data-app-theme="default"] {
      --hero-a: #f7cb46; --hero-b: #ffdd6f; --hero-c: #fe90e8;
    }
    /* ─── Theme: نبض (Pink/Pulse) — the landing page default ─── */
    html[data-app-theme="tech-field"] {
      --hero-a: #fe90e8; --hero-b: #f7cb46; --hero-c: #c0f7fe;
    }
    /* ─── Theme: أثير (Cyan/Aether) ─── */
    html[data-app-theme="tech-voice"] {
      --hero-a: #35d9ff; --hero-b: #c0f7fe; --hero-c: #f7cb46;
    }

    /* ─── Dark mode ─── */
    html.dark-mode {
      --bg:           hsl(0 0% 5%);
      --fg:           hsl(0 0% 98%);
      --card-bg:      hsl(0 0% 9%);
      --border-color: hsl(44 92% 62%);
      --muted-fg:     hsl(0 0% 60%);
      --dot-color:    rgba(255,203,70,0.15);
      --stripe-color: rgba(255,255,255,0.04);
      --nb-shadow:    6px 6px 0px 0px rgba(254,144,232,0.5), 0 0 20px 0 rgba(254,144,232,0.1);
      --nb-shadow-md: 4px 4px 0px 0px rgba(254,144,232,0.45);
      --nb-shadow-sm: 3px 3px 0px 0px rgba(254,144,232,0.4);
    }
    html.dark-mode[data-app-theme="default"] {
      --nb-shadow: 6px 6px 0px 0px rgba(247,203,70,0.55), 0 0 18px 0 rgba(247,203,70,0.12);
    }
    html.dark-mode[data-app-theme="tech-voice"] {
      --nb-shadow: 6px 6px 0px 0px rgba(53,217,255,0.5), 0 0 18px 0 rgba(53,217,255,0.1);
    }

    /* ═══════════════════════════════════════════
       BODY — exact match to the app's body bg
       ═══════════════════════════════════════════ */
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font);
      background-color: var(--bg);
      color: var(--fg);
      line-height: 1.7;
      font-weight: 700;
      font-size: clamp(1rem, 0.98rem + 0.2vw, 1.05rem);
      text-align: right;
      overflow-x: hidden;
      background-image:
        radial-gradient(circle at 15% 15%, color-mix(in srgb, var(--hero-a) 20%, transparent), transparent 24%),
        radial-gradient(circle at 85% 10%,  color-mix(in srgb, var(--hero-b) 16%, transparent), transparent 22%),
        radial-gradient(circle at 50% 80%,  color-mix(in srgb, var(--hero-c) 14%, transparent), transparent 24%),
        repeating-linear-gradient(135deg, var(--stripe-color) 0 2px, transparent 2px 18px),
        radial-gradient(circle, var(--dot-color) 1px, transparent 1px);
      background-attachment: fixed;
      background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%, 28px 28px;
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    /* ═══════════════════════════════════════════
       STICKY NAV SHELL — mirrors nb-header-shell
       ═══════════════════════════════════════════ */
    .nav-outer {
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 0.75rem 1rem 0.5rem;
    }
    .nav-container { max-width: 90rem; margin-inline: auto; }

    /* Exact replica of .nb-header-shell */
    .nb-header-shell {
      position: relative;
      border: 4px solid var(--border-color);
      border-radius: var(--r-xl);
      background: linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 48%, var(--hero-c) 100%);
      box-shadow: var(--nb-shadow);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      overflow: hidden;
    }
    html.dark-mode .nb-header-shell {
      background:
        linear-gradient(rgba(9,9,9,0.72), rgba(9,9,9,0.72)),
        linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 48%, var(--hero-c) 100%);
    }
    /* Diagonal stripe overlay — .nb-header-shell::before */
    .nb-header-shell::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: repeating-linear-gradient(135deg, rgba(0,0,0,0.14) 0 2px, transparent 2px 14px);
      opacity: 0.4;
      pointer-events: none;
    }
    /* Light shimmer — .nb-header-stripes */
    .nb-header-stripes {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent 35%, transparent 65%, rgba(255,255,255,0.1));
      opacity: 0.75;
      pointer-events: none;
    }

    .nav-content {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.4rem;
    }

    /* Logo */
    .nav-logo { display: flex; flex-direction: column; }
    .nav-logo-text {
      font-family: 'Cairo', serif;
      font-size: clamp(2rem, 4vw, 2.5rem);
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.08em;
    }
    .nav-logo-tagline {
      margin-top: 0.2rem;
      font-size: 0.72rem;
      font-weight: 800;
      opacity: 0.7;
    }

    /* Nav buttons */
    .nav-controls { display: flex; align-items: center; gap: 0.6rem; }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-family: var(--font);
      font-weight: 900;
      font-size: 0.85rem;
      padding: 0.5rem 1rem;
      border: 3px solid var(--border-color);
      border-radius: var(--r-md);
      box-shadow: var(--nb-shadow-sm);
      cursor: pointer;
      background: var(--card-bg);
      color: var(--fg);
      white-space: nowrap;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    .nav-btn:hover  { transform: translate(-2px,-2px); box-shadow: var(--nb-shadow-md); }
    .nav-btn:active { transform: translate(0,0); box-shadow: var(--nb-shadow-sm); }
    .nav-btn-cta {
      background: var(--fg);
      color: var(--bg);
    }
    html.dark-mode .nav-btn       { background: rgba(255,255,255,0.08); color: var(--fg); }
    html.dark-mode .nav-btn-cta   { background: var(--hero-a); color: #000; border-color: var(--border-color); }

    /* Theme color indicator dot */
    .theme-dot {
      width: 14px; height: 14px;
      border-radius: 50%;
      border: 2px solid var(--border-color);
      flex-shrink: 0;
      transition: background-color 0.2s;
    }

    /* ═══════════════════════════════════════════
       THEME DROPDOWN — liquid-glass-modal style
       ═══════════════════════════════════════════ */
    .theme-wrapper { position: relative; }
    .theme-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 10px);
      left: 0;
      min-width: 230px;
      border-radius: 20px;
      border: 3px solid var(--border-color);
      box-shadow: var(--nb-shadow);
      z-index: 9999;
      overflow: hidden;
      /* liquid-glass-modal */
      background: linear-gradient(145deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.76) 100%);
      backdrop-filter: blur(40px) saturate(180%);
      -webkit-backdrop-filter: blur(40px) saturate(180%);
    }
    html.dark-mode .theme-dropdown {
      background: linear-gradient(145deg, rgba(30,25,55,0.92) 0%, rgba(18,14,42,0.88) 100%);
      border-color: rgba(255,255,255,0.2);
      color: hsl(0 0% 98%);
    }
    .theme-dropdown.open { display: block; }

    .td-label {
      padding: 0.6rem 1rem 0.3rem;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.05em;
      opacity: 0.6;
    }
    .td-item {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      width: 100%;
      padding: 0.65rem 1rem;
      background: none;
      border: none;
      cursor: pointer;
      font-family: var(--font);
      font-weight: 900;
      font-size: 0.88rem;
      color: inherit;
      text-align: right;
      transition: background 0.12s;
    }
    .td-item:hover { background: rgba(0,0,0,0.06); }
    html.dark-mode .td-item:hover { background: rgba(255,255,255,0.08); }
    .td-item-label { flex: 1; }
    .td-check { opacity: 0; flex-shrink: 0; }
    .td-check.on { opacity: 1; }
    .td-color-dot {
      width: 16px; height: 16px;
      border-radius: 50%;
      border: 2px solid rgba(0,0,0,0.25);
      flex-shrink: 0;
    }
    .td-divider { height: 1px; background: rgba(0,0,0,0.1); margin: 0.25rem 0; }
    html.dark-mode .td-divider { background: rgba(255,255,255,0.12); }

    /* ═══════════════════════════════════════════
       HERO
       ═══════════════════════════════════════════ */
    .hero {
      max-width: 880px;
      margin: 0 auto;
      padding: 6rem 1.5rem 5rem;
      text-align: center;
    }
    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--hero-a);
      border: 3px solid var(--border-color);
      border-radius: var(--r-pill);
      padding: 0.65rem 2rem;
      /* Significantly larger and bolder than before */
      font-size: 1.2rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin-bottom: 2rem;
      box-shadow: var(--nb-shadow-sm);
    }
    html.dark-mode .hero-eyebrow {
      background: rgba(254,144,232,0.22);
      border-color: rgba(254,144,232,0.5);
    }
    .hero-title {
      font-family: 'Cairo', serif;
      font-size: clamp(2.2rem, 5.5vw, 3.8rem);
      font-weight: 900;
      line-height: 1.12;
      letter-spacing: -0.05em;
      margin-bottom: 1.4rem;
    }
    .hero-subtitle {
      font-size: 1.1rem;
      color: var(--muted-fg);
      max-width: 600px;
      margin: 0 auto 3rem;
      line-height: 1.85;
    }
    html.dark-mode .hero-subtitle { color: hsl(0 0% 65%); }
    .hero-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: var(--fg);
      color: var(--bg);
      font-family: var(--font);
      font-weight: 900;
      font-size: 1.05rem;
      padding: 0.95rem 2.5rem;
      border: 3px solid var(--border-color);
      border-radius: var(--r-pill);
      box-shadow: var(--nb-shadow);
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .hero-cta:hover { transform: translate(-3px,-3px); box-shadow: 13px 13px 0 0 rgba(0,0,0,0.88); }
    html.dark-mode .hero-cta { background: var(--hero-a); color: #000; }

    /* ─── Stripe divider ─── */
    .stripe-divider {
      height: 20px;
      background: repeating-linear-gradient(135deg, var(--hero-b), var(--hero-b) 10px, var(--border-color) 10px, var(--border-color) 20px);
      border-top: 3px solid var(--border-color);
      border-bottom: 3px solid var(--border-color);
    }

    /* ═══════════════════════════════════════════
       ABOUT
       ═══════════════════════════════════════════ */
    .about-section {
      max-width: 820px;
      margin: 0 auto;
      padding: 5.5rem 1.5rem;
      text-align: center;
    }
    .section-pill {
      display: inline-block;
      background: var(--hero-c);
      border: 3px solid var(--border-color);
      border-radius: var(--r-pill);
      padding: 0.3rem 1.2rem;
      font-size: 0.82rem;
      font-weight: 900;
      margin-bottom: 1.2rem;
      box-shadow: var(--nb-shadow-sm);
    }
    html.dark-mode .section-pill { background: rgba(192,247,254,0.2); border-color: rgba(192,247,254,0.35); }
    .about-title {
      font-family: 'Cairo', serif;
      font-size: clamp(1.8rem, 3.8vw, 2.6rem);
      font-weight: 900;
      letter-spacing: -0.04em;
      margin-bottom: 1.2rem;
    }
    .about-body { font-size: 1.05rem; color: var(--muted-fg); line-height: 1.9; }
    html.dark-mode .about-body { color: hsl(0 0% 65%); }

    /* ═══════════════════════════════════════════
       FEATURES — Dark section, full-width images
       ═══════════════════════════════════════════ */
    .features-section {
      background-color: var(--border-color);
      padding: 5.5rem 1.5rem;
    }
    html.dark-mode .features-section { background-color: hsl(0 0% 4%); }

    .features-inner { max-width: 1100px; margin: 0 auto; }

    .features-heading {
      text-align: center;
      margin-bottom: 4rem;
    }
    .features-heading .section-pill {
      background: var(--hero-a);
      border-color: rgba(255,255,255,0.3);
    }
    html.dark-mode .features-heading .section-pill {
      background: rgba(254,144,232,0.25);
      border-color: rgba(254,144,232,0.4);
    }
    .features-heading h2 {
      font-family: 'Cairo', serif;
      font-size: clamp(1.8rem, 3.8vw, 2.6rem);
      font-weight: 900;
      color: #fff;
      margin-top: 0.9rem;
      letter-spacing: -0.04em;
    }

    /* ── Feature Article ── */
    .feature-article {
      margin-bottom: 3.5rem;
      border: 4px solid rgba(255,255,255,0.14);
      border-radius: var(--r-xl);        /* 30px — matches app's panel radius */
      overflow: hidden;
      background: rgba(255,255,255,0.04);
      box-shadow: var(--nb-shadow-md);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .feature-article:last-child { margin-bottom: 0; }
    .feature-article:hover {
      transform: translate(-4px,-4px);
      box-shadow: var(--nb-shadow);
    }
    html.dark-mode .feature-article { border-color: rgba(255,255,255,0.08); }

    /* Text + Glassmorphism — liquid-glass style */
    .feature-text-glass {
      display: flex;
      align-items: flex-start;
      gap: 1.5rem;
      padding: 2.2rem 2.6rem;
      /* liquid-glass */
      background: linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%);
      backdrop-filter: blur(24px) saturate(200%);
      -webkit-backdrop-filter: blur(24px) saturate(200%);
      border-bottom: 1px solid rgba(255,255,255,0.16);
    }
    html.dark-mode .feature-text-glass {
      background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
    }
    .feature-emoji-large { font-size: 3rem; line-height: 1; flex-shrink: 0; margin-top: 0.15rem; }
    .feature-text-body { flex: 1; min-width: 0; }
    .feature-title {
      font-family: 'Cairo', serif;
      font-size: clamp(1.35rem, 2.6vw, 1.75rem);
      font-weight: 900;
      color: #fff;
      margin-bottom: 0.65rem;
      letter-spacing: -0.04em;
    }
    .feature-desc { font-size: 1rem; color: rgba(255,255,255,0.72); line-height: 1.8; }

    /* Full-width image below text */
    .feature-image-wrapper { overflow: hidden; max-height: 540px; }
    .feature-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.55s ease;
    }
    .feature-article:hover .feature-image { transform: scale(1.025); }

    /* ═══════════════════════════════════════════
       CTA BANNER
       ═══════════════════════════════════════════ */
    .cta-banner {
      background: linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 100%);
      border-top: 4px solid var(--border-color);
      border-bottom: 4px solid var(--border-color);
      padding: 5.5rem 1.5rem;
      text-align: center;
    }
    html.dark-mode .cta-banner {
      background:
        linear-gradient(rgba(9,9,9,0.6), rgba(9,9,9,0.6)),
        linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 100%);
    }
    .cta-banner-title {
      font-family: 'Cairo', serif;
      font-size: clamp(1.8rem, 3.8vw, 2.6rem);
      font-weight: 900;
      letter-spacing: -0.04em;
      margin-bottom: 2rem;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: var(--border-color);
      color: #fff;
      font-family: var(--font);
      font-weight: 900;
      font-size: 1.05rem;
      padding: 0.95rem 2.5rem;
      border: 3px solid var(--border-color);
      border-radius: var(--r-pill);
      box-shadow: var(--nb-shadow);
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .cta-btn:hover { transform: translate(-3px,-3px); box-shadow: 13px 13px 0 0 rgba(0,0,0,0.88); }

    /* ═══════════════════════════════════════════
       FOOTER
       ═══════════════════════════════════════════ */
    .footer {
      background: var(--border-color);
      color: rgba(255,255,255,0.7);
      text-align: center;
      padding: 2.5rem 1.5rem;
      font-size: 0.85rem;
    }
    html.dark-mode .footer { background: hsl(0 0% 3%); }
    .footer strong { color: var(--hero-a); }
    .footer-links { margin-top: 0.8rem; display: flex; justify-content: center; gap: 1.5rem; }
    .footer-links a { color: rgba(255,255,255,0.5); transition: color 0.15s; }
    .footer-links a:hover { color: var(--hero-a); }

    /* ═══════════════════════════════════════════
       AL-KASHAF DEMO SECTION
       ═══════════════════════════════════════════ */
    .scout-section {
      background: linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 60%, var(--hero-c) 100%);
      border-top: 4px solid var(--border-color);
      border-bottom: 4px solid var(--border-color);
      padding: 5.5rem 1.5rem;
    }
    html.dark-mode .scout-section {
      background:
        linear-gradient(rgba(9,9,9,0.72), rgba(9,9,9,0.72)),
        linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 60%, var(--hero-c) 100%);
    }
    .scout-inner { max-width: 700px; margin: 0 auto; }
    .scout-heading { text-align: center; margin-bottom: 2.5rem; }
    .scout-heading h2 {
      font-family: 'Cairo', serif;
      font-size: clamp(1.8rem, 3.8vw, 2.6rem);
      font-weight: 900;
      letter-spacing: -0.04em;
      margin: 0.8rem 0;
    }
    .scout-heading p { font-size: 1rem; opacity: 0.82; line-height: 1.7; }
    .scout-form { display: flex; gap: 0.75rem; margin-bottom: 2rem; }
    .scout-input {
      flex: 1;
      font-family: var(--font);
      font-size: 1rem;
      font-weight: 700;
      padding: 0.85rem 1.2rem;
      border: 3px solid var(--border-color);
      border-radius: var(--r-md);
      background: var(--card-bg);
      color: var(--fg);
      box-shadow: var(--nb-shadow-sm);
      outline: none;
      transition: box-shadow 0.15s;
    }
    .scout-input:focus { box-shadow: var(--nb-shadow); }
    html.dark-mode .scout-input { background: rgba(255,255,255,0.1); color: #fff; }
    .scout-btn {
      font-family: var(--font);
      font-weight: 900;
      font-size: 0.95rem;
      padding: 0.85rem 1.8rem;
      background: var(--border-color);
      color: #fff;
      border: 3px solid var(--border-color);
      border-radius: var(--r-md);
      box-shadow: var(--nb-shadow-sm);
      cursor: pointer;
      white-space: nowrap;
      transition: transform 0.12s, box-shadow 0.12s;
    }
    .scout-btn:hover:not(:disabled) { transform: translate(-2px,-2px); box-shadow: var(--nb-shadow-md); }
    .scout-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    html.dark-mode .scout-btn { background: rgba(0,0,0,0.55); border-color: rgba(255,255,255,0.3); }
    .scout-results { display: none; }
    .scout-results.show { display: block; }
    .scout-result-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem 1.2rem;
      background: var(--card-bg);
      border: 3px solid var(--border-color);
      border-radius: var(--r-md);
      box-shadow: var(--nb-shadow-sm);
      margin-bottom: 0.75rem;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .scout-result-card:hover { transform: translate(-2px,-2px); box-shadow: var(--nb-shadow-md); }
    html.dark-mode .scout-result-card { background: rgba(255,255,255,0.07); }
    .scout-num {
      flex-shrink: 0;
      width: 32px; height: 32px;
      background: var(--hero-a);
      border: 2px solid var(--border-color);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.82rem;
      font-weight: 900;
      color: var(--fg);
    }
    .scout-result-body { flex: 1; min-width: 0; }
    .scout-result-type {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 900;
      padding: 0.1rem 0.5rem;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      margin-bottom: 0.3rem;
      background: var(--hero-c);
    }
    html.dark-mode .scout-result-type { background: rgba(192,247,254,0.15); border-color: rgba(192,247,254,0.3); }
    .scout-result-name { font-size: 0.95rem; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 0.2rem; }
    .scout-result-desc { font-size: 0.85rem; color: var(--muted-fg); line-height: 1.6; }
    html.dark-mode .scout-result-desc { color: hsl(0 0% 60%); }
    .scout-error {
      padding: 1rem 1.2rem;
      background: var(--card-bg);
      border: 3px solid var(--border-color);
      border-radius: var(--r-md);
      text-align: center;
      font-weight: 900;
      font-size: 0.9rem;
    }
    .scout-cta-note {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .scout-cta-note a { text-decoration: underline; font-weight: 900; }

    /* ═══════════════════════════════════════════
       SMART DISPLAY SECTION
       ═══════════════════════════════════════════ */
    .smart-display-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 5.5rem 1.5rem;
    }
    .smart-display-header { text-align: center; margin-bottom: 3rem; }
    .smart-display-header h2 {
      font-family: 'Cairo', serif;
      font-size: clamp(1.8rem, 3.8vw, 2.6rem);
      font-weight: 900;
      letter-spacing: -0.04em;
      margin: 0.9rem 0 0.7rem;
    }
    .smart-display-header p { font-size: 1rem; color: var(--muted-fg); line-height: 1.75; }
    html.dark-mode .smart-display-header p { color: hsl(0 0% 60%); }
    .news-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 1.5rem;
    }
    .news-card {
      border: 3px solid var(--border-color);
      border-radius: var(--r-lg);
      background: var(--card-bg);
      box-shadow: var(--nb-shadow-md);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .news-card:hover { transform: translate(-3px,-3px); box-shadow: var(--nb-shadow); }
    html.dark-mode .news-card { background: var(--card-bg); }
    .news-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.65rem 1rem;
      background: var(--hero-b);
      border-bottom: 3px solid var(--border-color);
    }
    html.dark-mode .news-card-header { background: rgba(247,203,70,0.18); }
    .news-source-name { font-size: 0.78rem; font-weight: 900; }
    .news-tag {
      font-size: 0.68rem;
      font-weight: 900;
      padding: 0.15rem 0.55rem;
      background: var(--border-color);
      color: #fff;
      border-radius: 4px;
    }
    .news-card-body { padding: 1.2rem 1.3rem; flex: 1; }
    .news-original {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--muted-fg);
      direction: ltr;
      text-align: left;
      margin-bottom: 0.7rem;
      padding: 0.35rem 0.7rem;
      background: rgba(0,0,0,0.04);
      border-right: 3px solid var(--hero-a);
      border-radius: 4px;
      font-style: italic;
      line-height: 1.5;
    }
    html.dark-mode .news-original { background: rgba(255,255,255,0.05); border-right-color: var(--hero-a); color: hsl(0 0% 55%); }
    .news-ar-title {
      font-family: 'Cairo', serif;
      font-size: 1.05rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin-bottom: 0.75rem;
      line-height: 1.5;
    }
    .news-summary { font-size: 0.9rem; color: var(--muted-fg); line-height: 1.9; }
    html.dark-mode .news-summary { color: hsl(0 0% 60%); }
    .news-card-footer {
      padding: 0.75rem 1rem;
      border-top: 2px solid rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
    }
    html.dark-mode .news-card-footer { border-top-color: rgba(255,255,255,0.07); }
    .nasaq-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: var(--hero-a);
      border: 2px solid var(--border-color);
      border-radius: var(--r-pill);
      padding: 0.2rem 0.7rem;
      font-size: 0.7rem;
      font-weight: 900;
    }
    .news-date { color: var(--muted-fg); font-weight: 700; }
    html.dark-mode .news-date { color: hsl(0 0% 50%); }

    /* ═══════════════════════════════════════════
       LIVE NEWS FEED SECTION
       ═══════════════════════════════════════════ */
    .pnf-section {
      background: var(--bg);
      padding: 5rem 1.5rem;
    }
    .pnf-inner { max-width: 1200px; margin: 0 auto; }
    .pnf-header { text-align: center; margin-bottom: 2rem; }
    .pnf-header h2 {
      font-size: clamp(1.7rem, 3.5vw, 2.4rem);
      font-weight: 900;
      letter-spacing: -0.04em;
      margin: 0.7rem 0 0.5rem;
    }
    .pnf-header p { font-size: 0.95rem; color: var(--muted-fg); }
    .pnf-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1.75rem;
    }
    .pnf-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .pnf-tab {
      font-family: var(--font);
      font-size: 0.85rem;
      font-weight: 900;
      padding: 0.45rem 1rem;
      border: 2.5px solid var(--border-color);
      border-radius: 50px;
      background: var(--card-bg);
      color: var(--fg);
      cursor: pointer;
      transition: background 0.14s, transform 0.14s;
    }
    .pnf-tab.active, .pnf-tab:hover {
      background: var(--hero-a);
      transform: translate(-2px,-2px);
    }
    .pnf-view-toggle { display: flex; gap: 0.35rem; }
    .pnf-view-btn {
      font-family: var(--font);
      font-size: 0.82rem;
      font-weight: 900;
      padding: 0.4rem 0.9rem;
      border: 2.5px solid var(--border-color);
      border-radius: 50px;
      background: var(--card-bg);
      color: var(--fg);
      cursor: pointer;
      transition: background 0.14s;
    }
    .pnf-view-btn.active { background: var(--hero-b); }
    .pnf-panel { display: none; }
    .pnf-panel.active { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.4rem; }
    .pnf-empty { text-align: center; padding: 2rem; color: var(--muted-fg); font-size: 0.95rem; }
    .pnf-card {
      border: 2.5px solid var(--border-color);
      border-radius: var(--r-lg);
      background: var(--card-bg);
      box-shadow: var(--nb-shadow-md);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .pnf-card:hover { transform: translate(-3px,-3px); box-shadow: var(--nb-shadow); }
    .pnf-img-wrap { aspect-ratio: 16/9; overflow: hidden; border-bottom: 2.5px solid var(--border-color); }
    .pnf-img { width: 100%; height: 100%; object-fit: cover; }
    .pnf-card-body { padding: 1rem 1.1rem 0.8rem; display: flex; flex-direction: column; flex: 1; }
    .pnf-source { font-size: 0.72rem; font-weight: 900; color: var(--muted-fg); margin-bottom: 0.4rem; }
    .pnf-title { font-size: 0.96rem; font-weight: 900; line-height: 1.5; margin-bottom: 0.5rem; direction: ltr; text-align: left; }
    .pnf-summary { font-size: 0.84rem; color: var(--muted-fg); line-height: 1.75; direction: ltr; text-align: left; }
    .pnf-smart-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 900;
      background: var(--hero-a);
      border: 2px solid var(--border-color);
      border-radius: var(--r-pill);
      padding: 0.15rem 0.6rem;
      margin-bottom: 0.5rem;
    }
    .pnf-ar-title { font-size: 1rem; font-weight: 900; line-height: 1.5; margin-bottom: 0.5rem; }
    .pnf-ar-summary { font-size: 0.86rem; color: var(--muted-fg); line-height: 1.85; }
    .pnf-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 2px solid rgba(0,0,0,0.07);
      font-size: 0.73rem;
      color: var(--muted-fg);
    }
    html.dark-mode .pnf-meta { border-top-color: rgba(255,255,255,0.08); }
    .pnf-meta a { text-decoration: underline; font-weight: 900; color: var(--fg); }

    /* ═══════════════════════════════════════════
       HOW TO USE SECTION
       ═══════════════════════════════════════════ */
    .howto-section {
      background: #0d0d0d;
      padding: 5rem 1.5rem;
    }
    html.dark-mode .howto-section { background: #080808; }
    .howto-inner { max-width: 1100px; margin: 0 auto; }
    .howto-header { text-align: center; margin-bottom: 3rem; }
    .howto-header h2 {
      font-size: clamp(1.7rem, 3.5vw, 2.4rem);
      font-weight: 900;
      color: #fff;
      margin-top: 0.8rem;
      letter-spacing: -0.04em;
    }
    .howto-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.4rem;
    }
    .howto-step {
      background: #fff;
      border: 3px solid #0d0d0d;
      border-radius: var(--r-lg);
      padding: 2rem 1.5rem;
      box-shadow: var(--nb-shadow-md);
      text-align: center;
      position: relative;
    }
    html.dark-mode .howto-step { background: #1a1a1a; border-color: #333; }
    .howto-num {
      position: absolute;
      top: -14px;
      right: 1.2rem;
      background: var(--hero-a);
      border: 3px solid #0d0d0d;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      font-weight: 900;
    }
    .howto-emoji { font-size: 2.4rem; margin-bottom: 0.8rem; display: block; }
    .howto-step h3 { font-size: 1rem; font-weight: 900; margin-bottom: 0.5rem; }
    .howto-step p { font-size: 0.87rem; color: #555; line-height: 1.75; }
    html.dark-mode .howto-step h3 { color: #f0f0f0; }
    html.dark-mode .howto-step p { color: #888; }

    /* ═══════════════════════════════════════════
       RESPONSIVE
       ═══════════════════════════════════════════ */
    @media (max-width: 640px) {
      .nav-outer { padding: 0.6rem 0.75rem 0.45rem; }
      .nav-content { padding: 0.8rem 1rem; }
      .nb-header-shell { border-radius: 24px; }
      .nav-logo-tagline { display: none; }
      .hero { padding: 4rem 1.25rem 3.5rem; }
      .about-section { padding: 4rem 1.25rem; }
      .features-section { padding: 3.5rem 1rem; }
      .feature-text-glass { padding: 1.4rem 1.2rem; gap: 1rem; flex-direction: column; }
      .feature-emoji-large { font-size: 2.4rem; }
      .cta-banner { padding: 3.5rem 1.25rem; }
      .scout-section { padding: 3.5rem 1.25rem; }
      .scout-form { flex-direction: column; }
      .scout-btn { width: 100%; }
      .smart-display-section { padding: 3.5rem 1.25rem; }
      .news-grid { grid-template-columns: 1fr; }
      .pnf-section { padding: 3.5rem 1.1rem; }
      .pnf-panel.active { grid-template-columns: 1fr; }
      .pnf-controls { flex-direction: column; align-items: flex-start; }
      .howto-section { padding: 3.5rem 1.1rem; }
      .howto-grid { grid-template-columns: 1fr 1fr; }
      .footer-links { flex-wrap: wrap; gap: 0.8rem; }
    }
  </style>
</head>
<body>

  <!-- ══ NAVBAR ══════════════════════════════════════════ -->
  <div class="nav-outer">
    <div class="nav-container">
      <div class="nb-header-shell">
        <div class="nb-header-stripes" aria-hidden="true"></div>
        <div class="nav-content">

          <a href="/" class="nav-logo" aria-label="نَسَق — الصفحة الرئيسية">
            <span class="nav-logo-text">نَسَق</span>
            <span class="nav-logo-tagline">أخبار. تحليل. فكرة. إنتاج.</span>
          </a>

          <div class="nav-controls">

            <!-- Theme Toggle -->
            <div class="theme-wrapper" id="themeWrapper">
              <button
                class="nav-btn"
                id="themeBtn"
                onclick="toggleDropdown(event)"
                aria-label="إعدادات المظهر"
                title="إعدادات المظهر"
              >
                <span id="modeIcon">${SVG.sun}</span>
                ${SVG.palette}
                <span class="theme-dot" id="themeDot" style="background-color:#fe90e8"></span>
              </button>

              <div class="theme-dropdown" id="themeDropdown">
                <div class="td-label">الوضع</div>
                <button class="td-item" onclick="setMode('light')">
                  ${SVG.sun}
                  <span class="td-item-label">نهاري</span>
                  <span class="td-check on" id="chk-light">${SVG.check}</span>
                </button>
                <button class="td-item" onclick="setMode('dark')">
                  ${SVG.moon}
                  <span class="td-item-label">ليلي</span>
                  <span class="td-check" id="chk-dark">${SVG.check}</span>
                </button>
                <div class="td-divider"></div>
                <div class="td-label">المظاهر</div>
                <button class="td-item" onclick="setAccent('default')">
                  <span class="td-color-dot" style="background:#f7cb46"></span>
                  <span class="td-item-label">وهج</span>
                  <span class="td-check" id="chk-default">${SVG.check}</span>
                </button>
                <button class="td-item" onclick="setAccent('tech-field')">
                  <span class="td-color-dot" style="background:#fe90e8"></span>
                  <span class="td-item-label">نبض</span>
                  <span class="td-check on" id="chk-techfield">${SVG.check}</span>
                </button>
                <button class="td-item" onclick="setAccent('tech-voice')">
                  <span class="td-color-dot" style="background:#35d9ff"></span>
                  <span class="td-item-label">أثير</span>
                  <span class="td-check" id="chk-techvoice">${SVG.check}</span>
                </button>
              </div>
            </div>

            <a href="/login" class="nav-btn nav-btn-cta" aria-label="تسجيل الدخول">
              ${SVG.arrowLeft}
              تسجيل الدخول
            </a>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- ══ HERO ═══════════════════════════════════════════ -->
  <section class="hero">
    <div class="hero-eyebrow">✦ ${escapeHtml(hero.eyebrow)}</div>
    <h1 class="hero-title">${escapeHtml(hero.title)}</h1>
    <p class="hero-subtitle">${escapeHtml(hero.subtitle)}</p>
    <a href="/login" class="hero-cta">
      ${SVG.arrowLeft}
      ${escapeHtml(hero.ctaText)}
    </a>
  </section>

  <div class="stripe-divider" aria-hidden="true"></div>

  <!-- ══ ABOUT ══════════════════════════════════════════ -->
  <section class="about-section">
    <span class="section-pill">عن المنصة</span>
    <h2 class="about-title">${escapeHtml(about.title)}</h2>
    <p class="about-body">${escapeHtml(about.body)}</p>
  </section>

  <!-- ══ AL-KASHAF DEMO ══════════════════════════════════ -->
  <section class="scout-section">
    <div class="scout-inner">
      <div class="scout-heading">
        <span class="section-pill">🔭 جرّب الكاشف</span>
        <h2>اكتشف أفضل المصادر الأجنبية لمجالك</h2>
        <p>أدخل مجالك أو اهتمامك — سيقترح عليك الكاشف أبرز 5 مصادر RSS وقنوات يوتيوب الأجنبية المتخصصة التي يمكنك إضافتها فوراً لمتابعتك.</p>
      </div>
      <form class="scout-form" id="scoutForm" onsubmit="return false;">
        <input
          class="scout-input"
          id="scoutInput"
          type="text"
          placeholder="مثال: ذكاء اصطناعي، تسويق، يوتيوب..."
          maxlength="120"
          autocomplete="off"
          dir="rtl"
        />
        <button class="scout-btn" id="scoutBtn" type="submit">كشف المصادر</button>
      </form>
      <div class="scout-results" id="scoutResults"></div>
      <p class="scout-cta-note">
        محدود بـ 3 طلبات مجانية يومياً.
        <a href="/login">سجّل دخولك</a> للاستخدام غير المحدود ومتابعة المصادر تلقائياً.
      </p>
    </div>
  </section>

  <!-- ══ SMART DISPLAY ═════════════════════════════════ -->
  <section>
    <div class="smart-display-section">
      <div class="smart-display-header">
        <span class="section-pill">📡 العرض الذكي</span>
        <h2>أبرز الأخبار التقنية العالمية — مترجمة ومُلخَّصة</h2>
        <p>هذا مثال حي على ما يُقدّمه العرض الذكي في نَسَق: مقالات أجنبية من مصادر عالمية، مُترجَمة ومُلخَّصة إلى العربية تلقائياً لتوفير وقتك.</p>
      </div>
      <div class="news-grid">

        <!-- Card 1 -->
        <article class="news-card">
          <div class="news-card-header">
            <span class="news-source-name">TechCrunch</span>
            <span class="news-tag">ذكاء اصطناعي</span>
          </div>
          <div class="news-card-body">
            <p class="news-original">OpenAI Unveils GPT-5 With Extended Reasoning and Real-Time Web Access</p>
            <h3 class="news-ar-title">OpenAI تكشف النقاب عن GPT-5 بقدرات استدلال متقدمة ووصول فوري للإنترنت</h3>
            <p class="news-summary">كشفت شركة OpenAI رسمياً عن نموذجها الجديد GPT-5، الجيل الخامس من نماذج اللغة الكبيرة التي أحدثت ثورة في عالم الذكاء الاصطناعي. يتميز النموذج الجديد بقدرات استدلال موسّعة تُمكّنه من حل مسائل رياضية ومنطقية بدقة تفوق أداء الجيل السابق بنسبة تزيد على 40%. والأبرز في هذا الإصدار هو دعم الوصول الفوري للإنترنت، مما يعني أن النموذج يستطيع الاطلاع على آخر الأخبار والبيانات الحية دون الحاجة إلى تحديثات دورية. بالنسبة لصانعي المحتوى العربي، يُمثّل هذا النموذج نقلة نوعية في أدوات كتابة السيناريوهات وتوليد أفكار الفيديوهات، خاصةً مع تحسينات ملحوظة في فهم اللغة العربية وأساليبها الأدبية المتنوعة.</p>
          </div>
          <div class="news-card-footer">
            <span class="nasaq-badge">✦ ترجمة نَسَق</span>
            <span class="news-date">منذ 3 ساعات</span>
          </div>
        </article>

        <!-- Card 2 -->
        <article class="news-card">
          <div class="news-card-header">
            <span class="news-source-name">The Verge</span>
            <span class="news-tag">تقنية</span>
          </div>
          <div class="news-card-body">
            <p class="news-original">Apple Intelligence Now Available in 12 More Languages Including Arabic</p>
            <h3 class="news-ar-title">ذكاء آبل يدعم الآن 12 لغة إضافية بينها العربية للمرة الأولى</h3>
            <p class="news-summary">أعلنت شركة آبل عن توسيع نطاق ميزات الذكاء الاصطناعي المدمجة في أجهزتها لتشمل 12 لغة إضافية، من بينها العربية التي كانت غائبة عن الدعم الأولي. هذا التحديث يُتيح لمستخدمي iPhone 16 وiPad Pro وأجهزة Mac الحديثة الاستفادة من ميزات الكتابة الذكية والتلخيص التلقائي والاقتراحات السياقية باللغة العربية. وما يُميّز هذا النهج أن معالجة البيانات تتم محلياً على الجهاز دون إرسالها للسحابة، مما يعني خصوصية أعلى وسرعة استجابة أفضل. لصانعي المحتوى العربي، هذا يعني إمكانية استخدام Siri لتدوين الأفكار وتلخيص المقالات الطويلة باللغة العربية مباشرةً من الجهاز.</p>
          </div>
          <div class="news-card-footer">
            <span class="nasaq-badge">✦ ترجمة نَسَق</span>
            <span class="news-date">منذ 6 ساعات</span>
          </div>
        </article>

        <!-- Card 3 -->
        <article class="news-card">
          <div class="news-card-header">
            <span class="news-source-name">Wired</span>
            <span class="news-tag">صانعو المحتوى</span>
          </div>
          <div class="news-card-body">
            <p class="news-original">YouTube Doubles Revenue Share for Shorts Creators in Major Policy Shift</p>
            <h3 class="news-ar-title">يوتيوب يضاعف أرباح صانعي Shorts في تحوّل جذري بسياسة تقاسم الإيرادات</h3>
            <p class="news-summary">أعلنت منصة يوتيوب مضاعفة نسبة الأرباح لصانعي مقاطع Shorts في برنامجها المحدّث لتقاسم الإيرادات، في خطوة تعكس التنافس المتصاعد مع منصة TikTok. بموجب الشروط الجديدة، يحق لصانعي المحتوى الذين تجاوزوا 1000 مشترك و10 ملايين مشاهدة في آخر 90 يوماً الانضمام للبرنامج المحدّث والحصول على نسبة أرباح تصل إلى 45% من عائدات الإعلانات. بالنسبة للمجتمع العربي، يُعدّ هذا تحولاً جوهرياً؛ إذ بدأ كثير من صانعي المحتوى العرب الذين اكتفوا بالمحتوى الطويل في التوجه نحو Shorts لتعزيز دخلهم الرقمي وتوسيع قاعدة متابعيهم عالمياً.</p>
          </div>
          <div class="news-card-footer">
            <span class="nasaq-badge">✦ ترجمة نَسَق</span>
            <span class="news-date">منذ 9 ساعات</span>
          </div>
        </article>

        <!-- Card 4 -->
        <article class="news-card">
          <div class="news-card-header">
            <span class="news-source-name">Ars Technica</span>
            <span class="news-tag">سياسات تقنية</span>
          </div>
          <div class="news-card-body">
            <p class="news-original">EU's AI Act Compliance Deadline Forces Tech Giants to Restructure AI Teams</p>
            <h3 class="news-ar-title">قانون الذكاء الاصطناعي الأوروبي يدفع عمالقة التقنية لإعادة هيكلة فرقها</h3>
            <p class="news-summary">دخل قانون الذكاء الاصطناعي الأوروبي "AI Act" مرحلة التطبيق الفعلي، مما دفع شركات كـGoogle وMicrosoft وMeta إلى إعادة هيكلة فرق الذكاء الاصطناعي لديها لضمان الامتثال للوائح الجديدة. يُصنّف القانون تطبيقات الذكاء الاصطناعي وفقاً لمستويات المخاطر، ويفرض متطلبات شفافية صارمة تشمل الكشف عن بيانات التدريب وآليات اتخاذ القرار. الأهم لصانعي المحتوى: يُلزم القانون أدوات توليد الصور والصوت والنصوص بالإفصاح الواضح عن طبيعتها الاصطناعية. يرى المحللون أن هذا سيُفرز سوقاً متعددة المستويات بين أدوات متوافقة للسوق الأوروبية وأخرى تُسوَّق في مناطق أقل تنظيماً.</p>
          </div>
          <div class="news-card-footer">
            <span class="nasaq-badge">✦ ترجمة نَسَق</span>
            <span class="news-date">منذ 12 ساعة</span>
          </div>
        </article>

      </div>
    </div>
  </section>

  <!-- ══ FEATURES ═══════════════════════════════════════ -->
  ${
    features.length > 0
      ? `<section class="features-section">
    <div class="features-inner">
      <div class="features-heading">
        <span class="section-pill">المميزات</span>
        <h2>كل ما تحتاجه في مكان واحد</h2>
      </div>
      ${featuresHtml}
    </div>
  </section>`
      : ""
  }

  ${liveNewsHtml}

  ${howToUseHtml}

  <!-- ══ CTA BANNER ═════════════════════════════════════ -->
  <div class="cta-banner">
    <h2 class="cta-banner-title">ابدأ رحلتك مع نَسَق اليوم</h2>
    <a href="/login" class="cta-btn">
      ${SVG.arrowLeft}
      ${escapeHtml(hero.ctaText)}
    </a>
  </div>

  <!-- ══ FOOTER ═════════════════════════════════════════ -->
  <footer class="footer">
    <p>جميع الحقوق محفوظة &copy; <strong>نَسَق</strong> ${new Date().getFullYear()}</p>
    <div class="footer-links">
      <a href="/about">من نحن</a>
      <a href="/articles">المقالات</a>
      <a href="/contact">تواصل معنا</a>
      <a href="/terms">الشروط والأحكام</a>
      <a href="/privacy">سياسة الخصوصية</a>
      <a href="/login">تسجيل الدخول</a>
    </div>
  </footer>

  <!-- ══ LIVE NEWS TABS + VIEW TOGGLE JS ══════════════════ -->
  <script>
    (function () {
      // Tab switching
      var tabs = document.querySelectorAll('.pnf-tab');
      var panels = document.querySelectorAll('.pnf-panel');
      tabs.forEach(function (btn) {
        btn.addEventListener('click', function () {
          tabs.forEach(function (t) { t.classList.remove('active'); });
          panels.forEach(function (p) { p.classList.remove('active'); });
          btn.classList.add('active');
          var panel = document.querySelector('.pnf-panel[data-panel="' + btn.dataset.tab + '"]');
          if (panel) panel.classList.add('active');
        });
      });
      // Smart / Normal view toggle
      var normalBtn = document.getElementById('pnfNormalBtn');
      var smartBtn  = document.getElementById('pnfSmartBtn');
      function setView(smart) {
        document.querySelectorAll('.pnf-normal').forEach(function (el) { el.hidden = smart; });
        document.querySelectorAll('.pnf-smart').forEach(function (el) { el.hidden = !smart; });
        if (normalBtn) normalBtn.classList.toggle('active', !smart);
        if (smartBtn)  smartBtn.classList.toggle('active', smart);
      }
      if (normalBtn) normalBtn.addEventListener('click', function () { setView(false); });
      if (smartBtn)  smartBtn.addEventListener('click', function () { setView(true); });
    })();
  </script>

  <!-- ══ THEME TOGGLE JS ════════════════════════════════ -->
  <script>
    var THEME_COLORS = {
      'default':    '#f7cb46',
      'tech-field': '#fe90e8',
      'tech-voice': '#35d9ff',
    };
    var SUN_SVG  = '${escJs(SVG.sun)}';
    var MOON_SVG = '${escJs(SVG.moon)}';

    function getMode()   { return localStorage.getItem('nasaq-color-mode') || 'light'; }
    function getAccent() { return localStorage.getItem('nasaq-accent') || 'tech-field'; }

    function applyMode(cm) {
      var html = document.documentElement;
      html.setAttribute('data-color-mode', cm);
      if (cm === 'dark') html.classList.add('dark-mode');
      else               html.classList.remove('dark-mode');
      var icon = document.getElementById('modeIcon');
      if (icon) icon.innerHTML = cm === 'dark' ? MOON_SVG : SUN_SVG;
      syncCheck('chk-light', cm === 'light');
      syncCheck('chk-dark',  cm === 'dark');
    }

    function applyAccent(th) {
      document.documentElement.setAttribute('data-app-theme', th);
      var dot = document.getElementById('themeDot');
      if (dot) dot.style.backgroundColor = THEME_COLORS[th] || '#fe90e8';
      syncCheck('chk-default',   th === 'default');
      syncCheck('chk-techfield', th === 'tech-field');
      syncCheck('chk-techvoice', th === 'tech-voice');
    }

    function syncCheck(id, show) {
      var el = document.getElementById(id);
      if (!el) return;
      show ? el.classList.add('on') : el.classList.remove('on');
    }

    function setMode(cm)   { localStorage.setItem('nasaq-color-mode', cm); applyMode(cm); }
    function setAccent(th) { localStorage.setItem('nasaq-accent', th);     applyAccent(th); }

    function toggleDropdown(e) {
      e.stopPropagation();
      var dd = document.getElementById('themeDropdown');
      if (dd) dd.classList.toggle('open');
    }

    document.addEventListener('click', function (e) {
      var wrap = document.getElementById('themeWrapper');
      var dd   = document.getElementById('themeDropdown');
      if (dd && wrap && !wrap.contains(e.target)) dd.classList.remove('open');
    });

    // Sync UI state on load (localStorage may have a saved preference)
    applyMode(getMode());
    applyAccent(getAccent());
  </script>

  <!-- ══ AL-KASHAF DEMO JS ══════════════════════════════ -->
  <script>
    (function () {
      var form    = document.getElementById('scoutForm');
      var input   = document.getElementById('scoutInput');
      var btn     = document.getElementById('scoutBtn');
      var results = document.getElementById('scoutResults');
      if (!form) return;

      function escText(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var niche = input.value.trim();
        if (!niche) { input.focus(); return; }
        btn.disabled = true;
        btn.textContent = '...جارٍ البحث';
        results.innerHTML = '';
        results.classList.remove('show');

        fetch('/api/public/scout-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ niche: niche }),
          credentials: 'include',
        })
        .then(function (r) {
          return r.json().then(function (d) { return { ok: r.ok, data: d }; });
        })
        .then(function (res) {
          btn.disabled = false;
          btn.textContent = 'كشف المصادر';
          results.classList.add('show');
          if (!res.ok) {
            results.innerHTML = '<div class="scout-error">' + escText(res.data.error || 'حدث خطأ، حاول مجدداً.') + '</div>';
            return;
          }
          var sources = res.data.sources || [];
          if (!sources.length) {
            results.innerHTML = '<div class="scout-error">لم يُعثر على مصادر. جرّب مجالاً آخر.</div>';
            return;
          }
          var html = '';
          for (var i = 0; i < sources.length; i++) {
            var s = sources[i];
            html += '<div class="scout-result-card">'
                  +   '<div class="scout-num">' + (i + 1) + '</div>'
                  +   '<div class="scout-result-body">'
                  +     '<div class="scout-result-type">' + escText(s.type) + '</div>'
                  +     '<div class="scout-result-name">' + escText(s.name) + '</div>'
                  +     '<div class="scout-result-desc">' + escText(s.description) + '</div>'
                  +   '</div>'
                  + '</div>';
          }
          results.innerHTML = html;
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'كشف المصادر';
          results.classList.add('show');
          results.innerHTML = '<div class="scout-error">تعذّر الاتصال بالخادم. تحقق من اتصالك وأعد المحاولة.</div>';
        });
      });
    })();

    // Progressive auth check — for returning users whose localStorage flag was cleared
    // Runs silently after the page is fully loaded; does not block rendering
    window.addEventListener('load', function () {
      if (localStorage.getItem('nasaq-authed') === '1') return;
      fetch('/api/auth/me', { credentials: 'include' })
        .then(function (r) {
          if (r.ok) {
            localStorage.setItem('nasaq-authed', '1');
            window.location.replace('/dashboard');
          }
        })
        .catch(function () {});
    });
  </script>

</body>
</html>`;
}

// ─── simpleMarkdownToHtml ──────────────────────────────────────────────────
// Converts a small subset of Markdown to safe HTML without any npm dependency.
export function simpleMarkdownToHtml(md: string): string {
  let html = escapeHtml(md);

  // Code blocks (must come before inline code)
  html = html.replace(/```[\s\S]*?```/g, (m) =>
    `<pre><code>${m.slice(3, -3).trim()}</code></pre>`
  );
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // H1–H3
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>");
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Links
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr/>");
  // Paragraphs — double newlines
  html = html
    .split(/\n{2,}/)
    .map((para) => {
      const t = para.trim();
      if (!t) return "";
      if (/^<(h[1-3]|ul|li|pre|hr)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, "<br/>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  return html;
}

// ─── generateSimplePageHtml ────────────────────────────────────────────────
// Shared HTML shell for About, Contact, Terms, Articles pages.
export function generateSimplePageHtml(opts: {
  title: string;
  description?: string;
  bodyHtml: string;
  currentPath?: string;
}): string {
  const { title, description = title, bodyHtml } = opts;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — نَسَق</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="${escapeHtml(title)} — نَسَق" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta name="google-adsense-account" content="ca-pub-6128644359275323" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6128644359275323" crossorigin="anonymous"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --yellow: #F7CB46; --pink: #FE90E8;
      --black: #0d0d0d; --border: 2.5px solid #0d0d0d;
      --shadow: 5px 5px 0 0 rgba(0,0,0,0.85);
      --font: 'Cairo', 'Tajawal', sans-serif;
      --bg: #fafafa; --fg: #0d0d0d;
      --muted: #555; --card: #fff;
      --r: 16px;
    }
    body { font-family: var(--font); background: var(--bg); color: var(--fg); line-height: 1.75; }
    a { color: inherit; }
    /* Nav */
    .sp-nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.9rem 2rem; border-bottom: 2px solid #e5e5e5;
      background: #fff; position: sticky; top: 0; z-index: 10;
    }
    .sp-nav-logo { font-size: 1.4rem; font-weight: 900; text-decoration: none; color: var(--fg); }
    .sp-nav-cta {
      font-size: 0.85rem; font-weight: 900;
      background: var(--yellow); color: var(--fg);
      border: var(--border); border-radius: 50px; padding: 0.45rem 1.2rem;
      box-shadow: 4px 4px 0 0 rgba(0,0,0,0.85); text-decoration: none;
      transition: transform 0.12s, box-shadow 0.12s;
    }
    .sp-nav-cta:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 rgba(0,0,0,0.85); }
    /* Content */
    .sp-main { max-width: 820px; margin: 0 auto; padding: 4rem 2rem; }
    .sp-main h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 900; letter-spacing: -0.04em; margin-bottom: 1.5rem; }
    .sp-main h2 { font-size: 1.35rem; font-weight: 900; margin: 2rem 0 0.7rem; }
    .sp-main h3 { font-size: 1.1rem; font-weight: 900; margin: 1.5rem 0 0.5rem; }
    .sp-main p { font-size: 1rem; color: var(--muted); line-height: 1.85; margin-bottom: 1rem; }
    .sp-main ul { padding-right: 1.4rem; margin-bottom: 1rem; }
    .sp-main li { font-size: 0.96rem; color: var(--muted); line-height: 1.8; margin-bottom: 0.4rem; }
    .sp-main a { text-decoration: underline; color: var(--fg); font-weight: 700; }
    .sp-main strong { color: var(--fg); }
    .sp-main hr { border: none; border-top: 2px solid #e5e5e5; margin: 2rem 0; }
    .sp-breadcrumb { font-size: 0.82rem; color: var(--muted); margin-bottom: 2rem; }
    .sp-breadcrumb a { text-decoration: none; }
    .sp-breadcrumb a:hover { text-decoration: underline; }
    /* Footer */
    .sp-footer {
      background: #0d0d0d; color: #ccc; text-align: center;
      padding: 2rem; font-size: 0.82rem; margin-top: 4rem;
    }
    .sp-footer strong { color: var(--yellow); }
    .sp-footer-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 1.2rem; margin-top: 0.6rem; }
    .sp-footer-links a { color: #aaa; text-decoration: none; }
    .sp-footer-links a:hover { color: var(--yellow); }
    @media (max-width: 640px) { .sp-main { padding: 3rem 1.2rem; } .sp-nav { padding: 0.7rem 1rem; } }
  </style>
</head>
<body>
  <nav class="sp-nav">
    <a href="/" class="sp-nav-logo">نَسَق</a>
    <a href="/login" class="sp-nav-cta">تسجيل الدخول ←</a>
  </nav>
  <main class="sp-main">
    <p class="sp-breadcrumb"><a href="/">الرئيسية</a> ‹ ${escapeHtml(title)}</p>
    ${bodyHtml}
  </main>
  <footer class="sp-footer">
    <p>جميع الحقوق محفوظة &copy; <strong>نَسَق</strong> ${new Date().getFullYear()}</p>
    <div class="sp-footer-links">
      <a href="/about">من نحن</a>
      <a href="/articles">المقالات</a>
      <a href="/contact">تواصل معنا</a>
      <a href="/terms">الشروط والأحكام</a>
      <a href="/privacy">سياسة الخصوصية</a>
      <a href="/login">تسجيل الدخول</a>
    </div>
  </footer>
</body>
</html>`;
}
