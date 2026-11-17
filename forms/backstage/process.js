import url from 'url';
import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';

import {TroopsData, HeroData} from './data.js';
import {getHash} from './hash-table.js';

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

const readTextFile = (...p) =>
  fs.readFileSync(path.join(...p), {encoding: 'utf8'});

const templates = {
  attack: readTextFile(currDir, 'templates', 'attack.txt'),
  defense: readTextFile(currDir, 'templates', 'defense.txt'),
  '301': readTextFile(currDir, 'templates', '301.txt'),
  '302': readTextFile(currDir, 'templates', '302.txt'),
  '303': readTextFile(currDir, 'templates', '303.txt'),
  '304': readTextFile(currDir, 'templates', '304.txt'),
  '305': readTextFile(currDir, 'templates', '305.txt'),
  '351': readTextFile(currDir, 'templates', '351.txt'),
  '352': readTextFile(currDir, 'templates', '352.txt'),
};

const getUnitId = (id) => ((id>999)?Math.floor(id/100):id);

const sourceFiles =
  fs
    .readdirSync(currDir, {withFileTypes: true})
    .filter((entry) => (
      (!entry.name.startsWith('--')) &&
      (!entry.name.startsWith('__')) &&
      (entry.isFile()) &&
      (path.extname(entry.name) == '.yaml') &&
      (Number.isInteger(parseInt(entry.name.slice(0, 7))))
    ))
    .map((entry) => entry.name);

async function processSources() {
  for (let i = 0; i < sourceFiles.length; i++) {
    const isString = (s) => ((typeof s === 'string') && (s.length > 0));

    try {
      const fName = sourceFiles[i];
      const fPath = path.join(currDir, fName);
      const fBaseName = fName.slice(0, -'.yaml'.length);

      const source = yaml.load(readTextFile(fPath));

      const data = {
        id: 0,
        hash: '',
        alias: '',
        type: '',
        hero: '',
        'hero-position': '',
        'troop-stats': '',
        'counters': '',
        'message-link': '',
        'code': '',
      };

      if (typeof source.id === 'number') data.id = source.id;
      else data.id = parseInt(fBaseName.slice(0, 7));

      if (isString(source.hash)) data.hash = source.hash;
      else data.hash = getHash(data.id);

      if (isString(source.alias)) data.alias = source.alias;
      else data.alias = '';

      if (source.type === 'attack') data.type = 'attack';
      else data.type = 'defense';

      if (isString(source['message-link']))
        data['message-link'] = source['message-link'];

      if (isString(source.counters)) data.counters = source.counters;

      const formCategory = Math.floor(data.id / 10000);

      const isArenaFormation = (formCategory < 300);
      const isDefenseFormation = (isArenaFormation && (data.type !== 'attack'));
      // const isHHFormation = ((formCategory >= 300) && (formCategory < 400));
      // const isIWFormation = ((formCategory >= 400) && (formCategory < 500));
      // const is8KFormation = ((formCategory >= 800) && (formCategory < 900));

      const {troopLayout, heroLayout} = JSON.parse(atob(source.code));
      const sanitizedFormation = {
        GameMode: 0,
        troopLayout: {},
        heroLayout: {},
        armyLayout: null,
      };

      // Reset troop count
      TroopsData.forEach((troop)=>troop.count = 0);

      const layoutGrid = [
        Array(7).fill(null), Array(7).fill(null), Array(7).fill(null),
        Array(7).fill(null), Array(7).fill(null), Array(7).fill(null),
        Array(7).fill(null)
      ];

      for (let row = 0; row <= 6; row++) {
        for (let col = 0; col <= 6; col++) {
          const key = (row * 10 + col).toString();
          if (typeof troopLayout[key] === 'number') {
            const unitId = getUnitId(troopLayout[key]);
            TroopsData.find((troop)=>troop.id===unitId).count++;
            layoutGrid[row][col] = unitId;
            sanitizedFormation.troopLayout[key] = unitId;
          }
        }
      }

      data['troop-stats'] = TroopsData
        .filter((troop)=>(troop.count>0))
        .sort((a, b) => b.count - a.count)
        .map((troop) => troop.count + ' ' + troop.abbr)
        .join(' + ');

      if (isArenaFormation) {
        let symmetry = 0;
        for (let row = 0; row <= 6; row++) {
          for (let col = 0; col < 3; col++) {
            if (layoutGrid[row][col] === layoutGrid[row][6-col]) symmetry++;
          }
        }
        if (symmetry < 21) {
          if (symmetry < 5) {
            data['troop-stats'] =
              `(Asymmetric) ${data['troop-stats']}`;
          } else {
            symmetry = Math.round(100 * (21 - symmetry) / 21);
            data['troop-stats'] =
              `(${symmetry}% asymmetric) ${data['troop-stats']}`;
          }
        }
      }

      let heroId = 0;
      let heroPos = '';
      let heroName = '';
      if (typeof heroLayout['0'] === 'number') { // Back
        heroId = getUnitId(heroLayout['0']);
        sanitizedFormation.heroLayout['0'] = heroId;
        heroPos = 'B';
      } else if (typeof heroLayout['1'] === 'number') { // Left
        heroId = getUnitId(heroLayout['1']);
        sanitizedFormation.heroLayout['1'] = heroId;
        heroPos = 'L'; // Left
      } else if (typeof heroLayout['2'] === 'number') { // Right
        heroId = getUnitId(heroLayout['2']);
        sanitizedFormation.heroLayout['2'] = heroId;
        heroPos = 'R'; // Right
      }

      if (heroId !== 0) {
        const hero = HeroData.find((h) => h.id === heroId);
        heroName = hero?hero.name:`Hero ${heroId}`;
      }

      data.hero = heroName;
      data['hero-position'] = heroPos;

      data.code = btoa(JSON.stringify(sanitizedFormation));

      fs.writeFileSync(
        path.join(currDir, '../code', `${data.hash}.txt`),
        data.code
      );

      let messageTemplate = '';
      if (templates[formCategory.toString()]) {
        messageTemplate = templates[formCategory.toString()];
      } else if (isDefenseFormation) {
        messageTemplate = templates.defense;
      } else {
        messageTemplate = templates.attack;
      };

      const msg = messageTemplate
        .replaceAll('{{TROOP STATS}}', data['troop-stats'])
        .replaceAll('{{HERO NAME}}', `${heroName} (${heroPos})`)
        .replaceAll('{{FORM ID}}', data.id)
        .replaceAll(
          '{{FORM ALIAS}}',
          (data.alias.length)?` (${data.alias})`:'')
        .replaceAll('{{HASH}}', data.hash)
        .replaceAll(
          '{{COUNTERS}}',
          data.counters.trim().replaceAll('\n', '\\n'),
        );

      fs.writeFileSync(
        path.join(currDir, '../msg', `${data.id}.json`),
        msg
      );

      fs.writeFileSync(
        path.join(currDir, '../msg', `${data.id}.yaml`),
        yaml.dump(data),
      );

      fs.renameSync(fPath, path.join(currDir, 'form-archived', fName));
      

    } catch (e) {
      console.log(e);
    }
  }
}

processSources();
