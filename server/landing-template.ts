import type { LandingPageContent } from "@shared/landing-page-content";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateLandingHtml(content: LandingPageContent): string {
  const { hero, about, features, seo } = content;

  const featuresHtml = features
    .map(
      (f) => `
        <div class="feature-card">
          <div class="feature-emoji">${escapeHtml(f.emoji)}</div>
          <h3 class="feature-title">${escapeHtml(f.title)}</h3>
          <p class="feature-desc">${escapeHtml(f.description)}</p>
        </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(seo.metaTitle)}</title>
  <meta name="description" content="${escapeHtml(seo.metaDescription)}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="${escapeHtml(seo.metaTitle)}" />
  <meta property="og:description" content="${escapeHtml(seo.metaDescription)}" />
  <meta property="og:type" content="website" />
  <meta name="google-adsense-account" content="ca-pub-6128644359275323" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6128644359275323" crossorigin="anonymous"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --yellow: #F7CB46;
      --pink: #FE90E8;
      --blue: #C0F7FE;
      --green: #99E885;
      --black: #0d0d0d;
      --border: 3px solid #0d0d0d;
      --shadow: 6px 6px 0 0 rgba(0,0,0,0.88);
      --shadow-sm: 4px 4px 0 0 rgba(0,0,0,0.85);
      --radius: 20px;
      --font: 'Cairo', 'Tajawal', sans-serif;
    }

    body {
      font-family: var(--font);
      background: #fafafa;
      color: var(--black);
      line-height: 1.7;
    }

    a { color: inherit; text-decoration: none; }

    /* ── Nav ── */
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      border-bottom: 2px solid #e5e5e5;
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .nav-logo {
      font-size: 1.5rem;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .nav-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--yellow);
      color: var(--black);
      font-weight: 900;
      font-size: 0.9rem;
      padding: 0.55rem 1.4rem;
      border: var(--border);
      border-radius: 50px;
      box-shadow: var(--shadow-sm);
      transition: transform 0.12s, box-shadow 0.12s;
      cursor: pointer;
    }
    .nav-cta:hover {
      transform: translate(-2px, -2px);
      box-shadow: 8px 8px 0 0 rgba(0,0,0,0.88);
    }

    /* ── Hero ── */
    .hero {
      max-width: 900px;
      margin: 0 auto;
      padding: 5rem 2rem 4rem;
      text-align: center;
    }
    .hero-eyebrow {
      display: inline-block;
      background: var(--pink);
      border: var(--border);
      border-radius: 50px;
      padding: 0.3rem 1.2rem;
      font-size: 0.85rem;
      font-weight: 900;
      margin-bottom: 1.5rem;
      box-shadow: var(--shadow-sm);
    }
    .hero-title {
      font-size: clamp(2rem, 5vw, 3.4rem);
      font-weight: 900;
      line-height: 1.25;
      margin-bottom: 1.2rem;
      letter-spacing: -1px;
    }
    .hero-subtitle {
      font-size: 1.125rem;
      color: #444;
      max-width: 640px;
      margin: 0 auto 2.4rem;
      line-height: 1.8;
    }
    .hero-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--yellow);
      color: var(--black);
      font-weight: 900;
      font-size: 1.05rem;
      padding: 0.85rem 2.2rem;
      border: var(--border);
      border-radius: 50px;
      box-shadow: var(--shadow);
      transition: transform 0.12s, box-shadow 0.12s;
      cursor: pointer;
    }
    .hero-cta:hover {
      transform: translate(-3px, -3px);
      box-shadow: 9px 9px 0 0 rgba(0,0,0,0.88);
    }

    /* ── Stripe divider ── */
    .stripe {
      height: 24px;
      background: repeating-linear-gradient(
        135deg,
        var(--yellow),
        var(--yellow) 10px,
        #0d0d0d 10px,
        #0d0d0d 20px
      );
      border-top: 2px solid #0d0d0d;
      border-bottom: 2px solid #0d0d0d;
    }

    /* ── About ── */
    .about {
      max-width: 800px;
      margin: 0 auto;
      padding: 5rem 2rem;
      text-align: center;
    }
    .section-label {
      display: inline-block;
      background: var(--blue);
      border: var(--border);
      border-radius: 50px;
      padding: 0.25rem 1rem;
      font-size: 0.8rem;
      font-weight: 900;
      margin-bottom: 1.2rem;
      box-shadow: var(--shadow-sm);
    }
    .about-title {
      font-size: clamp(1.6rem, 3.5vw, 2.4rem);
      font-weight: 900;
      margin-bottom: 1.2rem;
    }
    .about-body {
      font-size: 1.05rem;
      color: #444;
      line-height: 1.9;
    }

    /* ── Features ── */
    .features-section {
      background: #0d0d0d;
      padding: 5rem 2rem;
    }
    .features-inner {
      max-width: 1100px;
      margin: 0 auto;
    }
    .features-heading {
      text-align: center;
      margin-bottom: 3rem;
    }
    .features-heading .section-label {
      background: var(--green);
    }
    .features-heading h2 {
      font-size: clamp(1.6rem, 3.5vw, 2.4rem);
      font-weight: 900;
      color: #fff;
      margin-top: 0.8rem;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
    }
    .feature-card {
      background: #fff;
      border: var(--border);
      border-radius: var(--radius);
      padding: 1.8rem 1.6rem;
      box-shadow: var(--shadow);
      transition: transform 0.12s, box-shadow 0.12s;
    }
    .feature-card:hover {
      transform: translate(-3px, -3px);
      box-shadow: 9px 9px 0 0 rgba(247,203,70,0.9);
    }
    .feature-emoji {
      font-size: 2.2rem;
      margin-bottom: 0.9rem;
      display: block;
    }
    .feature-title {
      font-size: 1.1rem;
      font-weight: 900;
      margin-bottom: 0.5rem;
    }
    .feature-desc {
      font-size: 0.92rem;
      color: #555;
      line-height: 1.75;
    }

    /* ── CTA Banner ── */
    .cta-banner {
      background: var(--yellow);
      border-top: var(--border);
      border-bottom: var(--border);
      padding: 4rem 2rem;
      text-align: center;
    }
    .cta-banner h2 {
      font-size: clamp(1.6rem, 3.5vw, 2.4rem);
      font-weight: 900;
      margin-bottom: 1.5rem;
    }
    .cta-banner-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #0d0d0d;
      color: #fff;
      font-weight: 900;
      font-size: 1.05rem;
      padding: 0.85rem 2.2rem;
      border: var(--border);
      border-radius: 50px;
      box-shadow: var(--shadow);
      transition: transform 0.12s, box-shadow 0.12s;
      cursor: pointer;
    }
    .cta-banner-btn:hover {
      transform: translate(-3px, -3px);
      box-shadow: 9px 9px 0 0 rgba(0,0,0,0.88);
    }

    /* ── Footer ── */
    .footer {
      background: #0d0d0d;
      color: #ccc;
      text-align: center;
      padding: 2.5rem 2rem;
      font-size: 0.85rem;
    }
    .footer strong { color: var(--yellow); }
    .footer-links { margin-top: 0.8rem; display: flex; justify-content: center; gap: 1.5rem; }
    .footer-links a { color: #aaa; transition: color 0.15s; }
    .footer-links a:hover { color: var(--yellow); }

    @media (max-width: 640px) {
      .nav { padding: 0.8rem 1rem; }
      .hero { padding: 3.5rem 1.2rem 3rem; }
      .about { padding: 3.5rem 1.2rem; }
      .features-section { padding: 3.5rem 1.2rem; }
      .cta-banner { padding: 3rem 1.2rem; }
    }
  </style>
</head>
<body>

  <!-- Navigation -->
  <nav class="nav">
    <span class="nav-logo">نَسَق</span>
    <a href="/login" class="nav-cta">تسجيل الدخول ←</a>
  </nav>

  <!-- Hero Section -->
  <section class="hero">
    <span class="hero-eyebrow">${escapeHtml(hero.eyebrow)}</span>
    <h1 class="hero-title">${escapeHtml(hero.title)}</h1>
    <p class="hero-subtitle">${escapeHtml(hero.subtitle)}</p>
    <a href="/login" class="hero-cta">${escapeHtml(hero.ctaText)} ←</a>
  </section>

  <div class="stripe"></div>

  <!-- About Section -->
  <section class="about">
    <span class="section-label">عن المنصة</span>
    <h2 class="about-title">${escapeHtml(about.title)}</h2>
    <p class="about-body">${escapeHtml(about.body)}</p>
  </section>

  <!-- Features Section -->
  ${
    features.length > 0
      ? `<section class="features-section">
    <div class="features-inner">
      <div class="features-heading">
        <span class="section-label">المميزات</span>
        <h2>كل ما تحتاجه في مكان واحد</h2>
      </div>
      <div class="features-grid">
        ${featuresHtml}
      </div>
    </div>
  </section>`
      : ""
  }

  <!-- CTA Banner -->
  <div class="cta-banner">
    <h2>ابدأ رحلتك مع نَسَق اليوم</h2>
    <a href="/login" class="cta-banner-btn">${escapeHtml(hero.ctaText)} ←</a>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <p>جميع الحقوق محفوظة &copy; <strong>نَسَق</strong> ${new Date().getFullYear()}</p>
    <div class="footer-links">
      <a href="/privacy">سياسة الخصوصية</a>
      <a href="/login">تسجيل الدخول</a>
    </div>
  </footer>

</body>
</html>`;
}
