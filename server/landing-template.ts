import type { LandingPageContent } from "@shared/landing-page-content";

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

export function generateLandingHtml(content: LandingPageContent): string {
  const { hero, about, features, seo } = content;

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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet" />

  <!-- Runs before paint — prevents FOUC on theme restore -->
  <script>
    (function () {
      var cm = localStorage.getItem('nasaq-color-mode') || 'light';
      var th = localStorage.getItem('nasaq-accent') || 'tech-field';
      var html = document.documentElement;
      html.setAttribute('data-color-mode', cm);
      html.setAttribute('data-app-theme', th);
      if (cm === 'dark') html.classList.add('dark-mode');
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
      <a href="/privacy">سياسة الخصوصية</a>
      <a href="/login">تسجيل الدخول</a>
    </div>
  </footer>

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

</body>
</html>`;
}
