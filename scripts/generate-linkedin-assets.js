const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, '../public/linkedin');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 1. LinkedIn Square Profile Logo (800x800) - Clean White Edition
// Specifically padded so LinkedIn's circular and squircle avatar crop never touches the edges!
const squareSvg = `
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.18" />
    </filter>
  </defs>

  <!-- Clean Background -->
  <rect width="800" height="800" fill="#FFFFFF" />

  <!-- Center Badge Container (Safe zone: 460x460 centered at 170,170 within 800x800) -->
  <g transform="translate(170, 170)" filter="url(#shadow)">
    <rect width="460" height="460" rx="120" fill="#1A4439" />
    <!-- Checkmark -->
    <path d="M130 240 L200 310 L335 155" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Accent Ping Dot -->
    <circle cx="345" cy="115" r="34" fill="#3FB68A" />
  </g>
</svg>
`;

// 2. LinkedIn Dark Theme Square Logo (800x800) - Deep Emerald Edition
const darkSquareSvg = `
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="#10b981" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Dark Slate/Emerald Background -->
  <rect width="800" height="800" fill="#0A1814" />

  <!-- Subtle aesthetic background circle -->
  <circle cx="400" cy="400" r="320" fill="none" stroke="#16382F" stroke-width="2" />

  <!-- Center Badge -->
  <g transform="translate(170, 170)" filter="url(#glow)">
    <rect width="460" height="460" rx="120" fill="#1A4439" stroke="#2D6354" stroke-width="4" />
    <path d="M130 240 L200 310 L335 155" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="345" cy="115" r="34" fill="#3FB68A" />
  </g>
</svg>
`;

// 3. LinkedIn Cover Banner (2256 x 382 px = 2x Retina of 1128x191)
// Specially engineered with safe-zone on the left (0 to 620px) where LinkedIn's avatar box sits!
const bannerSvg = `
<svg width="2256" height="382" viewBox="0 0 2256 382" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#051712" />
      <stop offset="40%" stop-color="#0A241C" />
      <stop offset="75%" stop-color="#0F382C" />
      <stop offset="100%" stop-color="#1A4439" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3FB68A" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#3FB68A" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="2256" height="382" fill="url(#bannerGrad)" />

  <!-- Ambient Glow Effects -->
  <circle cx="1950" cy="190" r="320" fill="url(#glowGrad)" />
  <circle cx="2180" cy="300" r="180" fill="#3FB68A" fill-opacity="0.08" />

  <!-- Left Side: Subtle decorative geometric lines behind where avatar sits -->
  <path d="M0 260 Q 300 120 600 200" fill="none" stroke="#163C31" stroke-width="2" stroke-dasharray="6,6" opacity="0.6" />
  <circle cx="280" cy="190" r="140" fill="none" stroke="#123329" stroke-width="2" opacity="0.5" />

  <!-- MAIN BRAND CONTENT (Shifted to x=660 to be 100% visible and unblocked by the avatar) -->
  <g transform="translate(660, 0)">
    <!-- Primary Title -->
    <text x="0" y="155" font-family="system-ui, -apple-system, sans-serif" font-size="82" font-weight="800" fill="#FFFFFF" letter-spacing="-1.5">
      EventCheckin
    </text>
    <text x="515" y="155" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700" fill="#3FB68A" letter-spacing="2">
      .TECH
    </text>

    <!-- Tagline -->
    <text x="2" y="222" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="600" fill="#E2E8F0" letter-spacing="-0.3">
      Welcome Every Guest with Hassle-Free Check-In
    </text>

    <!-- Feature Highlights -->
    <text x="2" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500" fill="#A3D4C4" letter-spacing="-0.1">
      QR Check-in at the Door  •  Digital Passes  •  Badge Studio  •  Self-Service Kiosks
    </text>
  </g>

  <!-- URL Pill on right -->
  <g transform="translate(1820, 150)">
    <rect width="320" height="74" rx="37" fill="#ffffff" fill-opacity="0.08" stroke="#3FB68A" stroke-width="2" />
    <text x="160" y="47" font-family="system-ui, -apple-system, sans-serif" font-size="25" font-weight="700" fill="#FFFFFF" text-anchor="middle">
      eventcheckin.tech
    </text>
  </g>
</svg>
`;

async function run() {
  await sharp(Buffer.from(squareSvg)).png().toFile(path.join(dir, 'linkedin-logo-white.png'));
  await sharp(Buffer.from(darkSquareSvg)).png().toFile(path.join(dir, 'linkedin-logo-dark.png'));
  await sharp(Buffer.from(bannerSvg)).png().toFile(path.join(dir, 'linkedin-cover-banner.png'));
  console.log('Generated all LinkedIn assets in', dir);
}

run().catch(console.error);
