import fs from 'fs';
import path from 'path';

interface RawProblemInput {
  name: string;
  link: string;
  rating?: string | number;
}

export interface Cp31Problem {
  id: string;
  title: string;
  band: number;
  index: number;
  url: string;
  order: number;
}

function cleanUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const parsed = new URL(trimmed);
  parsed.protocol = 'https:';
  parsed.search = '';
  parsed.hash = '';
  let fullUrl = parsed.toString();
  if (fullUrl.endsWith('/')) {
    fullUrl = fullUrl.slice(0, -1);
  }
  return fullUrl;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/convertCp31Input.ts <rawInputPath> [defaultBand]');
    process.exit(1);
  }

  const rawPath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(rawPath)) {
    console.error(`Error: File not found at path "${rawPath}"`);
    process.exit(1);
  }

  const fallbackBand = args[1] ? parseInt(args[1], 10) : 1300;
  if (isNaN(fallbackBand)) {
    console.error(`Error: Invalid fallback band "${args[1]}"`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(rawPath, 'utf-8');
  let rawItems: RawProblemInput[];
  try {
    rawItems = JSON.parse(rawContent);
  } catch (err: any) {
    console.error(`Error parsing JSON from "${rawPath}": ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(rawItems)) {
    console.error(`Error: Input file "${rawPath}" must contain a JSON array.`);
    process.exit(1);
  }

  const sheetPath = path.resolve(process.cwd(), 'src/data/cp31Sheet.json');
  let existingEntries: Cp31Problem[] = [];
  if (fs.existsSync(sheetPath)) {
    try {
      const content = fs.readFileSync(sheetPath, 'utf-8');
      existingEntries = JSON.parse(content);
    } catch {
      existingEntries = [];
    }
  }

  const existingBands = new Set(existingEntries.map((e) => e.band));
  const existingUrls = new Set(existingEntries.map((e) => e.url));
  const existingIds = new Set(existingEntries.map((e) => e.id));

  // Determine incoming items' target band
  const incomingBand = (function () {
    for (const item of rawItems) {
      if (item.rating && item.rating !== 'Unknown' && !isNaN(Number(item.rating))) {
        return Number(item.rating);
      }
    }
    return fallbackBand;
  })();

  if (existingBands.has(incomingBand)) {
    console.error(`Error: Band ${incomingBand} already exists in cp31Sheet.json.`);
    process.exit(1);
  }

  const newEntries: Cp31Problem[] = [];
  let idx = 1;
  for (const item of rawItems) {
    if (!item.name || !item.link) {
      console.error(`Error: Item at index ${idx - 1} is missing name or link.`);
      process.exit(1);
    }

    const title = item.name.trim();
    const url = cleanUrl(item.link);
    const itemBand =
      item.rating && item.rating !== 'Unknown' && !isNaN(Number(item.rating))
        ? Number(item.rating)
        : incomingBand;

    const paddedIndex = idx.toString().padStart(2, '0');
    const id = `cp31-${itemBand}-${paddedIndex}`;

    if (existingUrls.has(url)) {
      console.error(`Error: Duplicate URL found in input: "${url}"`);
      process.exit(1);
    }
    if (existingIds.has(id)) {
      console.error(`Error: Duplicate ID found in input: "${id}"`);
      process.exit(1);
    }

    newEntries.push({
      id,
      title,
      band: itemBand,
      index: idx,
      url,
      order: 0, // recomputed after sorting
    });

    idx++;
  }

  const merged = [...existingEntries, ...newEntries];

  merged.sort((a, b) => {
    if (a.band !== b.band) return a.band - b.band;
    return a.index - b.index;
  });

  merged.forEach((item, index) => {
    item.order = index + 1;
  });

  fs.mkdirSync(path.dirname(sheetPath), { recursive: true });
  fs.writeFileSync(sheetPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

  // Compute summary report
  const bandCounts = new Map<number, number>();
  for (const entry of merged) {
    bandCounts.set(entry.band, (bandCounts.get(entry.band) || 0) + 1);
  }

  console.log(`Successfully converted and saved ${sheetPath}`);
  console.log(`Total problems: ${merged.length}`);
  console.log('Bands breakdown:');
  Array.from(bandCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([b, count]) => {
      console.log(`- Band ${b}: ${count} problems`);
    });
}

main();
