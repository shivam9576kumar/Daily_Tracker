import fs from 'fs';
import path from 'path';

interface GfgMappingEntry {
  gfgUrl: string;
  gfgTitle: string;
}

const STRIVER_MAPPING_PATH = path.join(__dirname, '../src/data/striverGfgMapping.json');

export async function verifyGfgUrlsHttp(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: { id: string; url: string; status: number; ok: boolean; error?: string }[];
}> {
  const mappingData: Record<string, GfgMappingEntry> = JSON.parse(
    fs.readFileSync(STRIVER_MAPPING_PATH, 'utf8')
  );
  const entries = Object.entries(mappingData);
  const results: { id: string; url: string; status: number; ok: boolean; error?: string }[] = [];

  console.log(`Starting HTTP 200 reachability check for ${entries.length} mapped GFG URLs...`);

  for (const [id, data] of entries) {
    try {
      let res = await fetch(data.gfgUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      let status = res.status;
      if (status === 405) {
        res = await fetch(data.gfgUrl, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        status = res.status;
      }

      const ok = status === 200;
      results.push({ id, url: data.gfgUrl, status, ok });
      console.log(`  [${ok ? '200 OK' : `FAIL ${status}`}] ${id} -> ${data.gfgUrl}`);
    } catch (err: any) {
      results.push({ id, url: data.gfgUrl, status: 0, ok: false, error: err.message });
      console.error(`  [ERROR] ${id} -> ${data.gfgUrl}: ${err.message}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log('==================================================');
  console.log(`HTTP REACHABILITY VERIFICATION COMPLETE`);
  console.log(`Total URLs Checked : ${results.length}`);
  console.log(`Passed (200 OK)    : ${passed}`);
  console.log(`Failed (non-200)   : ${failed}`);
  console.log('==================================================');

  return { total: results.length, passed, failed, results };
}

if (require.main === module) {
  verifyGfgUrlsHttp().then(({ failed }) => {
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}
