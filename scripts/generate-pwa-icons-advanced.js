import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  try {
    // Ensure the assets directory exists
    const assetsDir = path.join(process.cwd(), 'public', 'assets');
    await fs.mkdir(assetsDir, { recursive: true });

    // Read the source favicon (SVG)
    const sourcePath = path.join(process.cwd(), 'public', 'assets', 'favicon.svg');
    
    // Generate transparent background icons (primary)
    console.log('Generating transparent background icons...');
    for (const size of sizes) {
      const outputPath = path.join(assetsDir, `icon-${size}x${size}.png`);
      
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`Generated icon-${size}x${size}.png (transparent)`);
    }

    // Generate white background icons (for dark themes)
    console.log('\nGenerating white background icons...');
    for (const size of sizes) {
      const outputPath = path.join(assetsDir, `icon-${size}x${size}-white.png`);
      
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`Generated icon-${size}x${size}-white.png (white background)`);
    }
    
    console.log('\nAll PWA icons generated successfully!');
    console.log('\nUsage:');
    console.log('- Use transparent icons (icon-*.png) for most cases');
    console.log('- Use white background icons (icon-*-white.png) for dark themes if needed');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons(); 