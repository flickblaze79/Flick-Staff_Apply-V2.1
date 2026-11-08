import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    base: '/FLICK-web-STAFF-APPLY-V2/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'generate-project-zip',
        buildStart() {
          const zip = new JSZip();
          const addDir = (dir: string, zipFolder: JSZip) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === '.aistudio') continue;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                const sub = zipFolder.folder(entry.name);
                if (sub) addDir(fullPath, sub);
              } else if (entry.isFile()) {
                try {
                  const content = fs.readFileSync(fullPath);
                  zipFolder.file(entry.name, content);
                } catch (err) {
                  // skip locked files
                }
              }
            }
          };
          try {
            addDir(__dirname, zip);
            zip.generateAsync({ type: 'nodebuffer' }).then((content) => {
              const pubDir = path.resolve(__dirname, 'public');
              if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
              fs.writeFileSync(path.join(pubDir, 'flick-staff-apply-v2-complete.zip'), content);
              console.log('Project ZIP generated successfully in public/');
            });
          } catch (e) {
            console.error('Error generating project zip:', e);
          }
        }
      },
      // Generate 404.html from index.html for GitHub Pages single-page app support
      {
        name: 'spa-404-fallback',
        closeBundle() {
          const indexPath = path.resolve(__dirname, 'dist/index.html');
          const notFoundPath = path.resolve(__dirname, 'dist/404.html');
          if (fs.existsSync(indexPath)) {
            fs.copyFileSync(indexPath, notFoundPath);
          }
        },
      },
      // In dev mode, redirect or rewrite root path / to the base path so preview URLs work seamlessly
      {
        name: 'root-redirect-dev',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/' || req.url === '/index.html') {
              res.writeHead(302, { Location: '/FLICK-web-STAFF-APPLY-V2/' });
              res.end();
              return;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
