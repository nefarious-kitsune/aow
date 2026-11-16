import url from 'url';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

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

const sourceFiles =
  fs
    .readdirSync(currDir, {withFileTypes: true})
    .filter((entry) => (
      (!entry.name.startsWith('--')) &&
      (!entry.name.startsWith('__')) &&
      (entry.isFile()) &&
      (path.extname(entry.name) == '.yaml')
    ))
    .map((entry) => entry.name);

async function processSources() {
  for (let i = 0; i < sourceFiles.length; i++) {
    const fileName = sourceFiles[i];
    const fBaseName = fileName.slice(0, -'.yaml'.length);
    const codeFPath = path.join(currDir, fileName);
    const source = yaml.load(readTextFile(path.join(currDir, fileName)));

    console.log(source);

    const exported = {};
    const isString = (s) => ((typeof s === 'string') && (s.length > 0));

    try {
      const formation = JSON.parse(atob(source.code));
      const {troopLayout, heroLayout} = formation;
      const formId = (source.id)?source.id:parseInt(fBaseName.slice(0, 7));

      if (typeof source.id === 'number') exported.id = source.id;
      else exported.id = parseInt(fBaseName.slice(0, 7));

      if (isString(source.hash)) exported.hash = source.hash;
      else exported.hash = getHash(exported.id);

      if (isString(source.hash)) exported.alias = source.hash;
      else exported.alias = '';

      if (source.type === 'attack') exported.type = 'attack';
      else exported.alias = 'defense';

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
          heroLayout: heroLayout,
          armyLayout: null,
        }))
      );

      const category = fileName.slice(0, 3);
      const jsonTemplate =
        templates[category]?templates[category]:templates.general;

      const mediaEntries = templates.mediaEntry.replace('{{HASH}}', formHash);

      const msg = jsonTemplate
        .replaceAll('{{FORM STATS}}', troopStats)
        .replaceAll('{{HERO NAME}}', `${heroName} (${heroPos})`)
        .replaceAll('{{FORM ID}}', formId)
        .replaceAll(
          '{{FORM ALIAS}}',
          (exported.alias.length)?` (${exported.alias})`:'')
        .replaceAll('{{HASH}}', exported.hash)
        .replaceAll('{{MEDIA ENTRIES}}', mediaEntries);

      fs.writeFileSync(path.join(currDir, '../msg', `${formId}.json`), msg);

      fs.renameSync(codeFPath, path.join(currDir, 'form-archived', fileName));

    } catch (e) {
      console.log(e);
    }
  }
}

processSources();
