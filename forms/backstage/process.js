import url from 'url';
import path from 'path';
import fs from 'fs';

import {TroopsData, HeroData} from './data.js';
import {getHash} from './hash-table.js';

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const readTextFile = (...p) =>
  fs.readFileSync(path.join(...p), {encoding: 'utf8'});

const templates = {
  general: readTextFile(currDir, 'templates', 'general.txt'),
  mediaEntry: readTextFile(currDir, 'templates', 'media-entry.txt'),
  '301': readTextFile(currDir, 'templates', '301.txt'),
  '302': readTextFile(currDir, 'templates', '302.txt'),
  '303': readTextFile(currDir, 'templates', '303.txt'),
  '304': readTextFile(currDir, 'templates', '304.txt'),
  '305': readTextFile(currDir, 'templates', '305.txt'),
};

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

async function processCode() {
  for (let i = 0; i < codeFiles.length; i++) {
    const codeFName = codeFiles[i];
    const fBaseName = path.basename(codeFName).slice(0, -'.txt'.length);
    let formId = parseInt(fBaseName.slice(0, 7));
    let formHash = '';
    let formAlias ='';

    if (Number.isNaN(formId)) {
      formId = fBaseName;
      formHash = fBaseName;
      formAlias = fBaseName;
    } else {
      formHash = getHash(formId);
      formAlias = fBaseName.slice(8);
    }

    const codeFPath = path.join(currDir, codeFName);
    const formJsonSource = atob(readTextFile(codeFPath));

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

      let troopStats = TroopsData
        .filter((troop)=>(troop.count>0))
        .sort((a, b) => b.count - a.count)
        .map((troop) => troop.count + ' ' + troop.abbr)
        .join(' + ');

      let symmetry = 0;
      for (let row = 0; row <= 6; row++) {
        for (let col = 0; col < 3; col++) {
          if (layoutGrid[row][col] === layoutGrid[row][6-col]) symmetry++;
        }
      }
      if (symmetry < 21) {
        if (symmetry < 5) {
          troopStats = '(Asymmetric) ' + troopStats;
        } else {
          symmetry = Math.round(100 * (21 - symmetry) / 21);
          troopStats = `(${symmetry}% asymmetric) `+ troopStats;
        }
      }

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

      const category = codeFName.slice(0, 3);
      const jsonTemplate =
        templates[category]?templates[category]:templates.general;

      const mediaEntries = templates.mediaEntry.replace('{{HASH}}', formHash);

      const msg = jsonTemplate
        .replaceAll('{{FORM STATS}}', troopStats)
        .replaceAll('{{HERO NAME}}', `${heroName} (${heroPos})`)
        .replaceAll('{{FORM ID}}', formId)
        .replaceAll('{{FORM ALIAS}}', (formAlias.length)?` (${formAlias})`:'')
        .replaceAll('{{HASH}}', formHash)
        .replaceAll('{{MEDIA ENTRIES}}', mediaEntries);

      fs.writeFileSync(path.join(currDir, '../msg', `${formId}.json`), msg);

      fs.renameSync(codeFPath, path.join(currDir, 'form-archived', codeFName));

    } catch (e) {
      console.log(e);
    }
  }
}

processCode();
