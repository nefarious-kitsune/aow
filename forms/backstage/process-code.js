import url from 'url';
import path from 'path';
import fs from 'fs';

import {TroopsData, HeroData} from './data.js';
import {getHash} from './hash-table.js';

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const primes = [
  232753, 312583, 195497, 830339, 420221, 144539, 280297, 260461,
  683257, 709201, 362393, 516233, 16253,  477539, 946177, 636319
];

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

codeFiles.forEach((fName) => {
  let id = parseInt(fName.slice(0, 7));
  let hash = '';

  if (Number.isNaN(id)) {
    id = path.basename(fName);
    hash = id;
  } else {
    hash = getHash(id);
  }

  const fPath = path.join(currDir, fName);
  const encoded = fs.readFileSync(fPath, {encoding: 'utf8'});
  const decoded = atob(encoded);

  try {
    const formation = JSON.parse(decoded);
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
      path.join(currDir, '../code', `${hash}.txt`),
      btoa(JSON.stringify({
        GameMode: 0,
        troopLayout: cleanedLayout,
        heroLayout: formation.heroLayout,
        armyLayout: null,
      }))
    );

    fs.renameSync(fPath, path.join(currDir, 'form-archived', fName));

    const msg = messageTemplate
      .replaceAll('{{FORM STATS}}', troopStats)
      .replaceAll('{{HERO NAME}}', `${heroName} (${heroPos})`)
      .replaceAll('{{FORM ID}}', id)
      .replaceAll('{{HASH}}', hash);

    fs.writeFileSync(path.join(currDir, '../msg', `${id}.json`), msg);
  } catch (e) {
    console.log(`${fName} not processed`);
  }
});
