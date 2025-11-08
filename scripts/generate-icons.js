const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceIcon = '/Users/jacobneudorf/Documents/coding/javascript/nextjs/unifiedledger/docs/UnitedLedgerIcon.png';
const publicDir = '/Users/jacobneudorf/Documents/coding/javascript/nextjs/unifiedledger/public';

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const sizes = [
  { size: 96, name: 'icon-96' },
  { size: 192, name: 'icon-192' },
  { size: 512, name: 'icon-512' },
];

async function generateIcons() {
  try {
    console.log('Starting icon generation...');

    for (const { size, name } of sizes) {
      // Regular icon
      const outputPath = path.join(publicDir, `${name}.png`);
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Created ${name}.png (${size}x${size})`);

      // Maskable variant (for adaptive icons)
      const maskableOutputPath = path.join(publicDir, `${name}-maskable.png`);
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toFile(maskableOutputPath);
      console.log(`✓ Created ${name}-maskable.png (${size}x${size})`);
    }

    // Create favicon
    const faviconPath = path.join(publicDir, 'favicon.png');
    await sharp(sourceIcon)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(faviconPath);
    console.log('✓ Created favicon.png (32x32)');

    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
