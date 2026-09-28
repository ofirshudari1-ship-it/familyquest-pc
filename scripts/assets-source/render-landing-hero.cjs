const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, 'landing-hero.svg');
const outWebp = path.join(__dirname, '..', '..', 'build', 'landing-hero.webp');
const outPng = path.join(__dirname, '..', '..', 'build', 'landing-hero.png');

sharp(src, { density: 220 })
  .resize(1200, 630)
  .webp({ quality: 92 })
  .toFile(outWebp)
  .then((info) => console.log('webp', info))
  .catch((e) => { console.error(e); process.exit(1); });

sharp(src, { density: 220 })
  .resize(1200, 630)
  .png()
  .toFile(outPng)
  .then((info) => console.log('png', info))
  .catch((e) => { console.error(e); process.exit(1); });
