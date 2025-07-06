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
    
    for (const size of sizes) {
      const outputPath = path.join(assetsDir, `icon-${size}x${size}.png`);
      
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`Generated icon-${size}x${size}.png`);
    }
    
    console.log('All PWA icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons(); 