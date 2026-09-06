import fs from 'fs';
import path from 'path';

interface StriverQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  url: string;
  order: number;
  tags?: string[];
}

interface GfgMappingEntry {
  gfgUrl: string;
  gfgTitle: string;
}

type GfgMappingMap = Record<string, GfgMappingEntry>;

const STRIVER_SHEET_PATH = path.join(__dirname, '../data/striverSheet.json');
const STRIVER_MAPPING_PATH = path.join(__dirname, '../data/striverGfgMapping.json');

const NON_TAKEUFORWARD_HOSTS = [
  'leetcode.com',
  'hackerrank.com',
  'interviewbit.com',
  'spoj.com',
  'codeforces.com',
  'codechef.com',
];

export function validateStriverGfgMapping(): {
  success: boolean;
  totalQuestions: number;
  candidateCount: number;
  mappedCount: number;
  unresolvedCount: number;
  errors: string[];
} {
  const errors: string[] = [];

  if (!fs.existsSync(STRIVER_SHEET_PATH)) {
    errors.push(`File missing: ${STRIVER_SHEET_PATH}`);
    return { success: false, totalQuestions: 0, candidateCount: 0, mappedCount: 0, unresolvedCount: 0, errors };
  }

  if (!fs.existsSync(STRIVER_MAPPING_PATH)) {
    errors.push(`File missing: ${STRIVER_MAPPING_PATH}`);
    return { success: false, totalQuestions: 0, candidateCount: 0, mappedCount: 0, unresolvedCount: 0, errors };
  }

  const striverSheet: StriverQuestion[] = JSON.parse(fs.readFileSync(STRIVER_SHEET_PATH, 'utf8'));
  const mappingData: GfgMappingMap = JSON.parse(fs.readFileSync(STRIVER_MAPPING_PATH, 'utf8'));

  // 1. Verify total entries count is 435
  const totalQuestions = striverSheet.length;
  if (totalQuestions !== 435) {
    errors.push(`Expected exactly 435 Striver entries, found ${totalQuestions}`);
  }

  // 2. Verify unique IDs & unique orders
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  let previousOrder = 0;
  let sortedOrders = true;

  striverSheet.forEach((q, idx) => {
    if (!q.id) {
      errors.push(`Entry index ${idx} is missing an 'id'`);
    } else if (seenIds.has(q.id)) {
      errors.push(`Duplicate Striver ID found: ${q.id}`);
    } else {
      seenIds.add(q.id);
    }

    if (typeof q.order !== 'number') {
      errors.push(`Entry ${q.id || idx} is missing a valid 'order' number`);
    } else if (seenOrders.has(q.order)) {
      errors.push(`Duplicate order number found: ${q.order} on ID ${q.id}`);
    } else {
      seenOrders.add(q.order);
      if (q.order < previousOrder) {
        sortedOrders = false;
      }
      previousOrder = q.order;
    }
  });

  if (!sortedOrders) {
    errors.push(`Striver entries order values are not strictly sorted`);
  }

  // 3. Count candidates (TakeUForward / Codolio URLs)
  const isCandidate = (q: StriverQuestion) => {
    const urlLower = q.url.toLowerCase();
    return urlLower.includes('takeuforward.org') || urlLower.includes('codolio.com');
  };

  const candidates = striverSheet.filter(isCandidate);
  const candidateCount = candidates.length;

  // 4. Validate mappings
  const mappingEntries = Object.entries(mappingData);
  const mappedIds = new Set<string>();
  const seenGfgUrls = new Set<string>();

  mappingEntries.forEach(([id, entry]) => {
    if (mappedIds.has(id)) {
      errors.push(`Duplicate mapping entry key found: ${id}`);
    }
    mappedIds.add(id);

    // Verify ID exists in sheet
    const targetQuestion = striverSheet.find((q) => q.id === id);
    if (!targetQuestion) {
      errors.push(`Mapping ID '${id}' does not exist in striverSheet.json`);
      return;
    }

    // Verify not mapping an already preserved external platform (LeetCode/HackerRank/InterviewBit/SPOJ)
    const targetUrlLower = targetQuestion.url.toLowerCase();
    const isNonTuf = NON_TAKEUFORWARD_HOSTS.some((host) => targetUrlLower.includes(host));
    if (isNonTuf) {
      errors.push(
        `Mapping ID '${id}' is already on a preserved external host ('${targetQuestion.url}') and should not be mapped to GFG`
      );
    }

    // Verify gfgUrl is valid HTTPS and GeeksforGeeks domain
    if (!entry.gfgUrl) {
      errors.push(`Mapping ID '${id}' has missing or empty 'gfgUrl'`);
    } else {
      try {
        const parsed = new URL(entry.gfgUrl);
        if (parsed.protocol !== 'https:') {
          errors.push(`Mapping ID '${id}' gfgUrl must use HTTPS: ${entry.gfgUrl}`);
        }
        if (parsed.hostname !== 'geeksforgeeks.org' && parsed.hostname !== 'www.geeksforgeeks.org') {
          errors.push(`Mapping ID '${id}' gfgUrl domain must be geeksforgeeks.org: ${entry.gfgUrl}`);
        }
        if (entry.gfgUrl.includes('/search?') || entry.gfgUrl.includes('google.com')) {
          errors.push(`Mapping ID '${id}' gfgUrl cannot be a search URL: ${entry.gfgUrl}`);
        }
      } catch (err) {
        errors.push(`Mapping ID '${id}' has invalid URL syntax: ${entry.gfgUrl}`);
      }

      if (seenGfgUrls.has(entry.gfgUrl)) {
        errors.push(`Duplicate gfgUrl mapped across multiple entries: ${entry.gfgUrl}`);
      } else {
        seenGfgUrls.add(entry.gfgUrl);
      }
    }
  });

  const mappedCount = mappedIds.size;
  const unresolvedCount = candidateCount - mappedCount;

  return {
    success: errors.length === 0,
    totalQuestions,
    candidateCount,
    mappedCount,
    unresolvedCount,
    errors,
  };
}
