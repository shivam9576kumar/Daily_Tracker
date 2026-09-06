import fs from 'fs';
import path from 'path';
import { titlesAreEquivalent, FORCE_REJECT } from '../src/services/plan/gfgTitleEquivalence';

interface StriverQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  url: string;
  order: number;
}

interface MappingRecord {
  gfgUrl: string;
  gfgTitle: string;
  status: 'verified' | 'rejected';
  equivalenceVerified: boolean;
  reason?: string;
  sourceUrl?: string;
}

const STRIVER_SHEET_PATH = path.join(__dirname, '../src/data/striverSheet.json');
const MAPPING_PATH = path.join(__dirname, '../src/data/striverGfgMapping.json');
const REPORT_DIR = path.join(__dirname, '../src/data/reports');
const REPORT_PATH = path.join(REPORT_DIR, 'striverGfgAudit.json');

export function auditStriverGfgMappings(): {
  totalMapped: number;
  keepCount: number;
  quarantineCount: number;
  keep: { id: string; striverTitle: string; gfgUrl: string; gfgTitle: string }[];
  quarantine: { id: string; striverTitle: string; gfgUrl: string; gfgTitle: string; reason: string }[];
  success: boolean;
} {
  const striverSheet: StriverQuestion[] = JSON.parse(fs.readFileSync(STRIVER_SHEET_PATH, 'utf8'));
  const rawMapping: Record<string, any> = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));

  const keep: { id: string; striverTitle: string; gfgUrl: string; gfgTitle: string }[] = [];
  const quarantine: { id: string; striverTitle: string; gfgUrl: string; gfgTitle: string; reason: string }[] = [];
  const updatedMapping: Record<string, MappingRecord> = {};

  const mappedEntries = Object.entries(rawMapping);

  for (const [id, entry] of mappedEntries) {
    const question = striverSheet.find((q) => q.id === id);
    const striverTitle = question ? question.title : 'UNKNOWN';
    const gfgTitle = entry.gfgTitle || '';
    const gfgUrl = entry.gfgUrl || '';
    const sourceUrl = question ? question.url : undefined;

    const isForceReject = FORCE_REJECT.has(id);
    const isEquivalent = question ? titlesAreEquivalent(striverTitle, gfgTitle, id) : false;

    if (isForceReject || !isEquivalent || !gfgUrl || !gfgTitle) {
      let reason = 'Title non-equivalence';
      if (isForceReject) reason = 'Hardcoded FORCE_REJECT list match';
      else if (!question) reason = 'Striver question ID not found';
      else if (!gfgUrl || !gfgTitle) reason = 'Missing GFG URL or title';

      quarantine.push({ id, striverTitle, gfgUrl, gfgTitle, reason });

      updatedMapping[id] = {
        gfgUrl,
        gfgTitle,
        status: 'rejected',
        equivalenceVerified: false,
        reason,
        sourceUrl,
      };
    } else {
      keep.push({ id, striverTitle, gfgUrl, gfgTitle });

      updatedMapping[id] = {
        gfgUrl,
        gfgTitle,
        status: 'verified',
        equivalenceVerified: true,
        sourceUrl,
      };
    }
  }

  // Ensure report directory exists and save report
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const auditReport = {
    totalMapped: mappedEntries.length,
    keepCount: keep.length,
    quarantineCount: quarantine.length,
    keep,
    quarantine,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(auditReport, null, 2), 'utf8');
  fs.writeFileSync(MAPPING_PATH, JSON.stringify(updatedMapping, null, 2), 'utf8');

  console.log('==================================================');
  console.log('STRIVER GFG MAPPING AUDIT REPORT');
  console.log('==================================================');
  console.log(`Total Mapped Entries : ${mappedEntries.length}`);
  console.log(`Keep (Verified)      : ${keep.length}`);
  console.log(`Quarantine (Rejected): ${quarantine.length}`);
  console.log(`Report written to    : ${REPORT_PATH}`);

  // Safety check: fail if any FORCE_REJECT id is status: 'verified'
  let hasViolation = false;
  for (const forceId of FORCE_REJECT) {
    if (updatedMapping[forceId]?.status === 'verified') {
      console.error(`CRITICAL VIOLATION: FORCE_REJECT ID '${forceId}' is still marked 'verified'!`);
      hasViolation = true;
    }
  }

  return {
    totalMapped: mappedEntries.length,
    keepCount: keep.length,
    quarantineCount: quarantine.length,
    keep,
    quarantine,
    success: !hasViolation,
  };
}

if (require.main === module) {
  const res = auditStriverGfgMappings();
  if (!res.success) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
