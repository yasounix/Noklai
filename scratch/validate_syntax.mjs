import fs from 'fs';
import * as babel from '@babel/core';

const files = [
  'src/modules/database.js',
  'src/modules/aiData.js',
  'src/modules/performance/SessionManager.js',
  'src/context/PatientContext.js',
  'src/noklai/context/NoklaiContext.js',
  'src/games/NortheastMemoryGame.js',
  'src/games/suhTahLam/SuhTahLamGame.js',
  'src/games/suhTahLam/engine/PerformanceTracker.js',
  'src/games/suhTahLam/engine/SessionManager.js',
  'src/games/suhTahLam/storage/LocalPerformanceStorage.js',
  'src/games/ubilakapki/UbilakapkiGame.js',
  'src/games/DhopkhelGame.js',
  'src/games/MemoryStoriesGame.js',
];

let failed = false;
files.forEach(f => {
  try {
    const code = fs.readFileSync(f, 'utf8');
    babel.parseSync(code, {
      filename: f,
      presets: ['babel-preset-expo'],
      plugins: ['@babel/plugin-syntax-jsx']
    });
    console.log(`✅ ${f} - OK`);
  } catch(e) {
    console.error(`❌ ${f} - ERROR: ${e.message}`);
    failed = true;
  }
});
if (failed) process.exit(1);
