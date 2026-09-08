import fs from 'fs';
import path from 'path';

interface Cp31Problem {
  id: string;
  title: string;
  band: number;
  index: number;
  url: string;
  order: number;
}

function main() {
  const sheetPath = path.resolve(process.cwd(), 'src/data/cp31Sheet.json');

  if (!fs.existsSync(sheetPath)) {
    console.error(`VALIDATION FAILED: File not found at "${sheetPath}"`);
    process.exit(1);
  }

  let entries: Cp31Problem[];
  try {
    const raw = fs.readFileSync(sheetPath, 'utf-8');
    entries = JSON.parse(raw);
  } catch (err: any) {
    console.error(`VALIDATION FAILED: Cannot parse JSON from "${sheetPath}": ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(entries)) {
    console.error('VALIDATION FAILED: cp31Sheet.json must be a JSON array.');
    process.exit(1);
  }

  if (entries.length === 0) {
    console.error('VALIDATION FAILED: cp31Sheet.json array is empty.');
    process.exit(1);
  }

  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenOrders = new Set<number>();
  const bandIndexMap = new Map<number, number[]>();

  let prevBand = -1;
  let prevIndex = -1;

  entries.forEach((entry, idx) => {
    const pos = idx + 1;

    // Type checks
    if (typeof entry.id !== 'string' || !entry.id) {
      errors.push(`Row ${pos}: Invalid or missing "id"`);
    }
    if (typeof entry.title !== 'string' || !entry.title.trim()) {
      errors.push(`Row ${pos}: Invalid or missing "title"`);
    }
    if (typeof entry.band !== 'number' || isNaN(entry.band)) {
      errors.push(`Row ${pos}: Invalid or missing "band"`);
    }
    if (typeof entry.index !== 'number' || isNaN(entry.index)) {
      errors.push(`Row ${pos}: Invalid or missing "index"`);
    }
    if (typeof entry.url !== 'string' || !entry.url) {
      errors.push(`Row ${pos}: Invalid or missing "url"`);
    }
    if (typeof entry.order !== 'number' || isNaN(entry.order)) {
      errors.push(`Row ${pos}: Invalid or missing "order"`);
    }

    if (errors.length > 0) return;

    // ID regex and format check
    const idMatch = /^cp31-(\d{3,4})-(\d{2})$/.exec(entry.id);
    if (!idMatch) {
      errors.push(`Row ${pos}: ID "${entry.id}" does not match regex /^cp31-\\d{3,4}-\\d{2}$/`);
    } else {
      const encodedBand = parseInt(idMatch[1], 10);
      const encodedIndex = parseInt(idMatch[2], 10);
      if (encodedBand !== entry.band) {
        errors.push(`Row ${pos}: ID "${entry.id}" encodes band ${encodedBand}, but band property is ${entry.band}`);
      }
      if (encodedIndex !== entry.index) {
        errors.push(`Row ${pos}: ID "${entry.id}" encodes index ${encodedIndex}, but index property is ${entry.index}`);
      }
    }

    // Uniqueness
    if (seenIds.has(entry.id)) {
      errors.push(`Row ${pos}: Duplicate id "${entry.id}"`);
    }
    seenIds.add(entry.id);

    if (seenUrls.has(entry.url)) {
      errors.push(`Row ${pos}: Duplicate url "${entry.url}"`);
    }
    seenUrls.add(entry.url);

    if (seenOrders.has(entry.order)) {
      errors.push(`Row ${pos}: Duplicate order "${entry.order}"`);
    }
    seenOrders.add(entry.order);

    // URL format checks
    try {
      const parsedUrl = new URL(entry.url);
      if (parsedUrl.protocol !== 'https:') {
        errors.push(`Row ${pos}: URL protocol must be "https:", got "${parsedUrl.protocol}"`);
      }
      if (parsedUrl.hostname !== 'codeforces.com' && parsedUrl.hostname !== 'www.codeforces.com') {
        errors.push(`Row ${pos}: Hostname must be codeforces.com, got "${parsedUrl.hostname}"`);
      }
      if (
        !parsedUrl.pathname.startsWith('/problemset/problem/') &&
        !parsedUrl.pathname.startsWith('/contest/')
      ) {
        errors.push(`Row ${pos}: URL path must start with /problemset/problem/ or /contest/, got "${parsedUrl.pathname}"`);
      }
      if (parsedUrl.search) {
        errors.push(`Row ${pos}: URL must not contain query parameters, found "${parsedUrl.search}"`);
      }
    } catch {
      errors.push(`Row ${pos}: Invalid URL string "${entry.url}"`);
    }

    // Sorting check (band ASC, index ASC)
    if (entry.band < prevBand) {
      errors.push(`Row ${pos}: Band ${entry.band} appears after higher band ${prevBand} (must be sorted ASC by band)`);
    } else if (entry.band === prevBand) {
      if (entry.index <= prevIndex) {
        errors.push(`Row ${pos}: Index ${entry.index} appears after ${prevIndex} within band ${entry.band} (must be sorted ASC by index)`);
      }
    }
    prevBand = entry.band;
    prevIndex = entry.index;

    // Track index per band
    if (!bandIndexMap.has(entry.band)) {
      bandIndexMap.set(entry.band, []);
    }
    bandIndexMap.get(entry.band)!.push(entry.index);
  });

  // Check orders 1..N contiguous
  if (errors.length === 0) {
    const orders = Array.from(seenOrders).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        errors.push(`Orders are not contiguous 1..N (expected ${i + 1}, found ${orders[i]})`);
        break;
      }
    }
  }

  // Check index per band contiguous 1..count
  if (errors.length === 0) {
    bandIndexMap.forEach((indexes, band) => {
      indexes.sort((a, b) => a - b);
      for (let i = 0; i < indexes.length; i++) {
        if (indexes[i] !== i + 1) {
          errors.push(`Band ${band}: Indexes are not contiguous 1..count (expected ${i + 1}, found ${indexes[i]})`);
          break;
        }
      }
    });
  }

  if (errors.length > 0) {
    console.error(`VALIDATION FAILED (${errors.length} error(s)):`);
    errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  }

  const bandReport = Array.from(bandIndexMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([band, idxs]) => ({ band, count: idxs.length }));

  const report = {
    bands: bandReport,
    total: entries.length,
    valid: true,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
