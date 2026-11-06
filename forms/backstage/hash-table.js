import url from 'url';
import path from 'path';
import fs from 'fs';

const currDir = path.dirname(url.fileURLToPath(import.meta.url));

let hashTableInit = false;
let hashTableStream = null;
const hashTable = [];
const hashTableFPath = path.join(currDir, 'hash-table.tsv');

// let newHashCount = 0;

function openHashTable() {
  if ((!hashTableInit) && (fs.existsSync(hashTableFPath))) {
    fs
      .readFileSync(hashTableFPath, {encoding: 'utf8'})
      .split('\n')
      .forEach((line) => {
        if (line.length > 0) {
          const [id, hash] = line.split('\t');
          hashTable.push({id: parseInt(id), hash: hash});
        }
      });
  }
  hashTableInit = true;
}

function updateHash(formId, hash) {
  if (!hashTableStream) {
    hashTableStream =
      fs.createWriteStream(
        hashTableFPath,
        {encoding: 'utf8', flags:'a'}
      );

    console.log('Hash table stream opened');

    process.on('exit', (code) => {
      hashTableStream.end();
      console.log('Hash table closed');
    });
  }

  hashTable.push({id: formId, hash: hash});
  hashTableStream.write(formId + '\t' + hash + '\n');
}

export function getHash(formId) {
  if (!hashTableInit) openHashTable();

  let entry = hashTable.find((e) => (e.id === formId))
  if (entry) return entry.hash;
  else {
    let ts = Math.floor(new Date() / 316);
    // const uint32ts = (ts + newHashCount++) >>> 0;
    const uint32ts = ts >>> 0;
    const bMask = 260461;
    const bShift = 7;
    const prefix = (formId > 10000)?Math.floor(formId/10000):999;

    let lHash = prefix.toString(36);
    if (lHash.length < 2) lHash = lHash.padStart(2, '0');

    let rHash = (
        (((uint32ts >>> bShift) | (uint32ts << (32-bShift))) ^ bMask)
        >>> 0
      ).toString(36);
    if (rHash.length < 7) rHash = rHash.padStart(7, '0');

    const hash = lHash + rHash;
    updateHash(formId, hash)
    return hash;
  }
}
