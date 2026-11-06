import url from 'url';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

import {TroopsData, HeroData} from './data.js';
import {getHash} from './hash-table.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const messageTemplate = fs.readFileSync(
  path.join(currDir, 'message-template.json'), {encoding: 'utf8'}
);

const codeFiles =
  fs
    .readdirSync(currDir, {withFileTypes: true})
    .filter((entry) => (
      (!entry.name.startsWith('--')) &&
      (!entry.name.startsWith('__')) &&
      (entry.isFile()) &&
      (path.extname(entry.name) == '.txt')
    ))
    .map((entry) => entry.name);

const idLabelSvgTemplate =
`<svg width="380" height="100">'
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
  class="title">{{LABEL}}</text>
</svg>`;

async function processImages(fName, id, label, hash) {
  const fPath = path.join(currDir, fName);
  const exportedFPath =
    path.join(currDir, '../ss', `${hash}${path.extname(fName)}`);
  const archivedFPath =
    path.join(currDir, 'ss-archive', fName);

  const image = sharp(fPath);
  const {width, height} = await image.metadata();

  if ((width === 1206) && (height === 2622)) {
    const w = 1204;
    const h = 1505;
    const svgText = idLabelSvgTemplate.replace('{{LABEL}}', label);
    const svgBuffer = Buffer.from(svgText);
    await image
      .extract({left: (1206-w), width: w, height: h, top: (1979+25-h)})
      .composite([{input: svgBuffer, left: 40, top: 100}])
      .toFile(exportedFPath);

    fs.renameSync(fPath, archivedFPath);
    await delay(Math.floor(Math.random()*5189 + 800));
  } else {
    console.log(`${id} (${width} x ${height}) skipped`)
  }
}

async function processCode() {
  for (let i = 0; i < codeFiles.length; i++) {
    const codeFName = codeFiles[i];
    const fBaseName = path
      .basename(codeFName)
      .slice(0, -path.extname(codeFName).length);
    let formId = parseInt(fBaseName.slice(0, 7));
    let formHash = '';
    const formAlias =(fBaseName.length > 7)?fBaseName.slice(8):'';

    if (Number.isNaN(formId)) {
      formId = fBaseName;
      formHash = fBaseName;
    } else {
      formHash = getHash(formId);
    }

    const formLabel = (formAlias.length)?formAlias:formId;

    const codeFPath = path.join(currDir, codeFName);
    const imageFPath = path.join(currDir, `${formId}.png`);
    if (!fs.existsSync(imageFPath)) continue;

    const formJsonSource = atob(fs.readFileSync(codeFPath, {encoding: 'utf8'}));

    try {
      const formation = JSON.parse(formJsonSource);
      const {troopLayout, heroLayout} = formation;

      // Reset troop count
      TroopsData.forEach((troop)=>troop.count = 0);

      const layoutGrid = [
        Array(7).fill(null), Array(7).fill(null), Array(7).fill(null),
        Array(7).fill(null), Array(7).fill(null), Array(7).fill(null),
        Array(7).fill(null)
      ];

      const cleanedLayout = {};

      for (let row = 0; row <= 6; row++) {
        for (let col = 0; col <= 6; col++) {
          const key = (row * 10 + col).toString();
          if (typeof troopLayout[key] === 'number') {
            let unitId = troopLayout[key];
            if (unitId > 999) unitId = Math.floor(unitId/100);
            TroopsData.find((troop)=>troop.id===unitId).count++;
            layoutGrid[row][col] = unitId;
            cleanedLayout[key] = unitId;
          }
        }
      }

      let symmetry = 0;
      for (let row = 0; row <= 6; row++) {
        for (let col = 0; col < 3; col++) {
          if (layoutGrid[row][col] === layoutGrid[row][6-col]) symmetry++;
        }
      }

      let troopStats =
        (symmetry === 21)?
        '':
        `(${Math.round(100 * (21 - symmetry) / 21)}% asymmetric) `

      troopStats += TroopsData
        .filter((troop)=>(troop.count>0))
        .sort((a, b) => b.count - a.count)
        .map((troop) => troop.count + ' ' + troop.abbr)
        .join(' + ');

      let heroId = -1;
      let heroPos = '';
      let heroName = '';
      if (typeof heroLayout['0'] !== 'undefined') { // Back
        heroId = heroLayout['0'];
        heroPos = 'B';
      } else if (typeof heroLayout['1'] !== 'undefined') { // Left
        heroId = heroLayout['1'];
        heroPos = 'L'; // Left
      } else if (typeof heroLayout['2'] !== 'undefined') { // Right
        heroId = heroLayout['2'];
        heroPos = 'R'; // Right
      }

      if (heroId !== -1) {
        if (heroId > 999) heroId = Math.floor(heroId/100);
        const hero = HeroData.find((h) => h.id === heroId);
        heroName = hero?hero.name:`Hero ${heroId}`;
      }

      fs.writeFileSync(
        path.join(currDir, '../code', `${formHash}.txt`),
        btoa(JSON.stringify({
          GameMode: 0,
          troopLayout: cleanedLayout,
          heroLayout: formation.heroLayout,
          armyLayout: null,
        }))
      );

      fs.renameSync(codeFPath, path.join(currDir, 'form-archived', codeFName));

      const msg = messageTemplate
        .replaceAll('{{FORM STATS}}', troopStats)
        .replaceAll('{{HERO NAME}}', `${heroName} (${heroPos})`)
        .replaceAll('{{FORM ID}}', formId)
        .replaceAll('{{FORM ALIAS}}', (formAlias.length)?` (${formAlias})`:'')
        .replaceAll('{{HASH}}', formHash);

      fs.writeFileSync(path.join(currDir, '../msg', `${formId}.json`), msg);

      await processImages(`${formId}.png`, formId, formLabel, formHash);
    } catch (e) {
      // console.log(`${codeFName} not processed`);
      console.log(e);
    }
  }
}

processCode();
