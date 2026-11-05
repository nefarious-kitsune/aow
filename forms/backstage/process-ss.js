import url from 'url';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const primes = [
  232753, 312583, 195497, 830339, 420221, 144539, 280297, 260461,
  683257, 709201, 362393, 516233, 16253,  477539, 946177, 636319
];

const imageFiles =
  fs
    .readdirSync(currDir, {withFileTypes: true})
    .filter((entry) => (
      (!entry.name.startsWith('--')) &&
      (!entry.name.startsWith('__')) &&
      (entry.isFile()) &&
      (path.extname(entry.name) == '.png')
    ))
    .map((entry) => entry.name);

const promises = imageFiles.map(async (fName) => {
  let id = parseInt(fName.slice(0, 7));
  let idExt = '';

  if (Number.isNaN(id)) id = path.basename(fName);
  else idExt = '-' + (id ^ primes[id % 16]).toString(16).toUpperCase();

  const fPath = path.join(currDir, fName);
  const exportedFName = `${id}${idExt}${path.extname(fName)}`;
  const exportedFPath = path.join(currDir, '../ss', exportedFName);
  const archivedFPath = path.join(currDir, 'ss-archive', fName);

  const image = sharp(fPath);
  const {width, height} = await image.metadata();

  if ((width === 1206) && (height === 2622)) {
    const w = 1204;
    const h = 1505;
    const svgText = `
    <svg width="380" height="100">
      <style>
        .title {
          fill: black;
          font-size: 68px;
          font-family: "Fira Sans", sans-serif;
          font-weight: 500;
          font-style: normal;
        }
      </style>
      <rect width="100%" height="100%" fill="#f0f0f0A0" />
      <text x="5%" y="50%"
        dominant-baseline="central"
        text-anchor="start"
        class="title">${id}</text>
    </svg>`;

    const svgBuffer = Buffer.from(svgText);

    await image
      .extract({left: (1206-w), width: w, height: h, top: (1979+25-h)})
      .composite([{input: svgBuffer, left: 40, top: 100}])
      .toFile(exportedFPath);

    fs.renameSync(fPath, archivedFPath);
  } else {
    console.log(`${exportedFName} (${width} x ${height}skipped`)
  }
});

await Promise.all(promises);
console.log('all image files processed')
