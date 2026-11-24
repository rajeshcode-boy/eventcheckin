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
const bannerSvg = `
<svg width="2256" height="382" viewBox="0 0 2256 382" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#061D17" />
      <stop offset="50%" stop-color="#0E332A" />
      <stop offset="100%" stop-color="#1A4439" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3FB68A" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#3FB68A" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect width="2256" height="382" fill="url(#bannerGrad)" />
  <circle cx="1900" cy="190" r="320" fill="url(#glowGrad)" />
  <circle cx="2150" cy="280" r="180" fill="#3FB68A" fill-opacity="0.06" />

  <!-- Logo Mark -->
  <g transform="translate(140, 96)">
    <rect width="190" height="190" rx="50" fill="#102E26" stroke="#2A6B59" stroke-width="3" />
    <path d="M52 100 L82 130 L138 65" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="145" cy="50" r="14" fill="#3FB68A" />
  </g>

  <!-- Typography -->
  <text x="370" y="185" font-family="system-ui, -apple-system, sans-serif" font-size="80" font-weight="800" fill="#FFFFFF" letter-spacing="-1.5">
    EventCheckin
  </text>
  <text x="880" y="185" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="#3FB68A" letter-spacing="2">
    .TECH
  </text>
  <text x="372" y="245" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="500" fill="#A3D4C4" letter-spacing="-0.2">
    Welcome Every Guest with Hassle-Free Check-In • QR Passes • Badge Printing • Live Kiosks
  </text>

  <!-- URL Pill on right -->
  <g transform="translate(1760, 150)">
    <rect width="360" height="76" rx="38" fill="#ffffff" fill-opacity="0.08" stroke="#3FB68A" stroke-width="2" />
    <text x="180" y="48" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="700" fill="#FFFFFF" text-anchor="middle">
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
