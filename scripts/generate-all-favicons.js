import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

async function generateAllFavicons() {
  try {
    // Ensure the assets directory exists
    const assetsDir = path.join(process.cwd(), 'public', 'assets');
    await fs.mkdir(assetsDir, { recursive: true });

    // Read the source favicon (SVG)
    const sourcePath = path.join(process.cwd(), 'public', 'assets', 'favicon.svg');
    
    console.log('Generating all favicon files from SVG...\n');

    // Generate traditional favicon files
    const faviconSizes = [
      { size: 16, name: 'favicon-16.png' },
      { size: 32, name: 'favicon-32.png' },
      { size: 48, name: 'favicon-48.png' },
      { size: 64, name: 'favicon-64.png' }
    ];

    for (const { size, name } of faviconSizes) {
      const outputPath = path.join(assetsDir, name);
      
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`Generated ${name} (${size}x${size})`);
    }

    // Generate main favicon.png (32x32 is standard)
    const mainFaviconPath = path.join(assetsDir, 'favicon.png');
    await sharp(sourcePath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(mainFaviconPath);
    
    console.log('Generated favicon.png (32x32)');

    // Generate ICO file (multi-size ICO with 16x16, 32x32, 48x48)
    const icoPath = path.join(assetsDir, 'favicon.ico');
    
    // Create ICO with multiple sizes
    const icoSizes = [16, 32, 48];
    const icoBuffers = [];
    
    for (const size of icoSizes) {
      const buffer = await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      icoBuffers.push(buffer);
    }
    
    // For now, we'll use the 32x32 PNG as ICO (most browsers support this)
    // A proper ICO file would require a more complex library
    await fs.writeFile(icoPath, icoBuffers[1]); // Use 32x32 as ICO
    console.log('Generated favicon.ico (32x32 PNG format)');

    // Generate PWA icons (if not already present)
    console.log('\nGenerating PWA icons...');
    const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];
    
    for (const size of pwaSizes) {
      const outputPath = path.join(assetsDir, `icon-${size}x${size}.png`);
      
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`Generated icon-${size}x${size}.png`);
    }
    
    console.log('\n✅ All favicon files generated successfully!');
    console.log('\nGenerated files:');
    console.log('- favicon-16.png (16x16)');
    console.log('- favicon-32.png (32x32)');
    console.log('- favicon-48.png (48x48)');
    console.log('- favicon-64.png (64x64)');
    console.log('- favicon.png (32x32, main favicon)');
    console.log('- favicon.ico (32x32, ICO format)');
    console.log('- PWA icons (72x72 to 512x512)');
    
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateAllFavicons(); 