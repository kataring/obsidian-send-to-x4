import { execSync } from 'child_process';
import { createWriteStream, readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Read manifest for version info
const manifest = JSON.parse(readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version = manifest.version;
const pluginId = manifest.id;

// Files to include in release
const releaseFiles = ['main.js', 'manifest.json'];
if (existsSync(path.join(rootDir, 'styles.css'))) {
  releaseFiles.push('styles.css');
}

async function createRelease() {
  console.log(`Creating release for ${pluginId} v${version}...`);

  // Build first
  console.log('Building plugin...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  // Verify all files exist
  for (const file of releaseFiles) {
    const filePath = path.join(rootDir, file);
    if (!existsSync(filePath)) {
      console.error(`Error: Required file not found: ${file}`);
      process.exit(1);
    }
  }

  // Create zip
  const zip = new JSZip();
  for (const file of releaseFiles) {
    const content = readFileSync(path.join(rootDir, file));
    zip.file(file, content);
  }

  const zipFileName = `${pluginId}-${version}.zip`;
  const zipPath = path.join(rootDir, zipFileName);

  const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
  const writeStream = createWriteStream(zipPath);
  writeStream.write(zipContent);
  writeStream.end();

  console.log(`\nRelease package created: ${zipFileName}`);
  console.log('\nIncluded files:');
  releaseFiles.forEach(f => console.log(`  - ${f}`));
}

createRelease().catch(err => {
  console.error('Error creating release:', err);
  process.exit(1);
});
