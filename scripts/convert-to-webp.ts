import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public');

async function convertPngToWebp() {
  const files = fs.readdirSync(publicDir);
  
  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.png') {
      const inputPath = path.join(publicDir, file);
      const outputPath = path.join(publicDir, path.parse(file).name + '.webp');
      
      console.log(`Converting ${file} to WebP...`);
      await sharp(inputPath).webp().toFile(outputPath);
      console.log(`Saved to ${outputPath}`);
    }
  }
}

convertPngToWebp().catch(console.error);
