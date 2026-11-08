
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const zip = new JSZip();

const addDir = (dir: string, zipFolder: JSZip) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' || 
      entry.name === 'dist' || 
      entry.name === '.git' || 
      entry.name === '.aistudio' ||
      entry.name === 'package-lock.json' ||
      entry.name === 'Flick-Staff-Apply-V2.1-FIXED.zip'
    ) continue;
    
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = zipFolder.folder(entry.name);
      if (sub) addDir(fullPath, sub);
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(entry.name, content);
      } catch (err) {
        console.warn('Skipping locked file:', fullPath);
      }
    }
  }
};

addDir(rootDir, zip);
zip.generateAsync({ type: 'nodebuffer' }).then((content) => {
  fs.writeFileSync(path.join(rootDir, 'Flick-Staff-Apply-V2.1-FIXED.zip'), content);
  console.log('Flick-Staff-Apply-V2.1-FIXED.zip generated successfully in root directory.');
});
