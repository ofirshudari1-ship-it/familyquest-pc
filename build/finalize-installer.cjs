// Per STANDARDS.md §1, the final installer belongs in the project ROOT, not
// buried in a release/ subfolder — electron-builder itself still needs a
// working output directory (win-unpacked/, blockmap, builder-debug.yml), so
// that stays under build/release/ (an allowed "intermediate" location) and
// only the finished .exe (+ its .blockmap, needed for differential updates)
// is copied up to root. Also removes any older FamilyQuest-PC-Setup-*.exe
// left in root from a previous version, so exactly one installer is ever
// visible there (STANDARDS.md hard rule: no duplicate installers).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const releaseDir = path.join(root, 'build', 'release');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const exeName = `FamilyQuest-PC-Setup-${version}.exe`;
const blockmapName = `${exeName}.blockmap`;
const src = path.join(releaseDir, exeName);
if (!fs.existsSync(src)) {
  console.error(`Expected installer not found: ${src}`);
  process.exit(1);
}

for (const old of fs.readdirSync(root)) {
  if (/^FamilyQuest-PC-Setup-.*\.exe(\.blockmap)?$/.test(old) && old !== exeName && old !== blockmapName) {
    fs.unlinkSync(path.join(root, old));
    console.log(`Removed older installer artifact from root: ${old}`);
  }
}

fs.copyFileSync(src, path.join(root, exeName));
console.log(`Installer ready at project root: ${exeName}`);

const blockmapSrc = path.join(releaseDir, blockmapName);
if (fs.existsSync(blockmapSrc)) {
  fs.copyFileSync(blockmapSrc, path.join(root, blockmapName));
  console.log(`Blockmap ready at project root: ${blockmapName}`);
}
