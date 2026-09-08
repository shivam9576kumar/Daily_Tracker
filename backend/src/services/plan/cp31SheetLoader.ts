import cp31Sheet from '../../data/cp31Sheet.json';

export interface Cp31Problem {
  id: string;
  title: string;
  band: number;
  index: number;
  url: string;
  order: number;
}

export function loadCp31Sheet(): Cp31Problem[] {
  const rawList = cp31Sheet as Cp31Problem[];
  return rawList
    .filter(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        typeof p.band === 'number' &&
        typeof p.index === 'number' &&
        typeof p.url === 'string'
    )
    .sort((a, b) => {
      if (a.band !== b.band) return a.band - b.band;
      return a.index - b.index;
    });
}

export function getCp31Bands(): { band: number; count: number }[] {
  const problems = loadCp31Sheet();
  const bandMap = new Map<number, number>();

  for (const p of problems) {
    bandMap.set(p.band, (bandMap.get(p.band) || 0) + 1);
  }

  return Array.from(bandMap.entries())
    .map(([band, count]) => ({ band, count }))
    .sort((a, b) => a.band - b.band);
}

export function getCp31Problems(band: number): Cp31Problem[] {
  return loadCp31Sheet()
    .filter((p) => p.band === band)
    .sort((a, b) => a.index - b.index);
}

export function getCp31ProblemById(id: string): Cp31Problem | null {
  const found = loadCp31Sheet().find((p) => p.id === id);
  return found || null;
}
