const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.jsx') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Rename variables and classes
  newContent = newContent.replace(/--green-primary/g, '--brand-primary');
  newContent = newContent.replace(/--green-secondary/g, '--brand-secondary');
  newContent = newContent.replace(/--green-light/g, '--brand-light');
  newContent = newContent.replace(/text-green/g, 'text-brand');
  newContent = newContent.replace(/dashboard-title-green/g, 'dashboard-title-brand');

  // Replace raw colors in SVG/CSS
  newContent = newContent.replace(/%230e7a33/gi, '%23DC2626'); // SVG hex
  newContent = newContent.replace(/rgba\(14,\s*122,\s*51,/g, 'rgba(220, 38, 38,'); // rgba

  // Update root variables in index.css
  if (file.endsWith('index.css')) {
    newContent = newContent.replace(/--brand-primary:\s*#0E7A33;/g, '--brand-primary:    #DC2626;');
    newContent = newContent.replace(/--brand-secondary:\s*#0B8F3A;/g, '--brand-secondary:  #991B1B;');
    newContent = newContent.replace(/--brand-light:\s*#E8F5E9;/g, '--brand-light:      #FEF2F2;');
  }

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated: ' + file);
  }
});

console.log('Refactor complete.');
