// Static + runtime-shape checker for Date Picker v3.
// Usage: node scripts/checkDatePickerV3.mjs   (from frontend/)
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

let fail = 0;
const ck = (name, cond) => { console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}`); if (!cond) fail++; };

const picker = readFileSync('src/components/todo/TodoDatePicker.tsx', 'utf8');
const dates = readFileSync('src/utils/todoDates.ts', 'utf8');
const css = readFileSync('src/components/todo/todo.css', 'utf8');
const composer = readFileSync('src/components/todo/InlineTodoComposer.tsx', 'utf8');

// Layout order in source: typed → list → cal → Time btn → Repeat btn
const idx = (s) => picker.indexOf(s);
ck('layout order typed<quick<cal<time<repeat',
  idx('Type a date') > -1 &&
  idx('Type a date') < picker.indexOf('quickDateOptionsV3().map') &&
  picker.indexOf('quickDateOptionsV3().map') < idx('tdp-cal') &&
  idx('tdp-cal') < idx("setPanel('time')") &&
  idx("setPanel('time')") < idx("setPanel('repeat')"));

// No timezone UI
ck('no timezone selector', !/time\s*zone|timezone/i.test(picker.replace(/\/\/.*$/gm, '')));

// Time panel pieces
ck('time input type=time', picker.includes('type="time"'));
ck('duration select present', picker.includes('DURATION_OPTIONS') && (picker.includes('No duration') === false ? dates.includes('No duration') : dates.includes('No duration')));
ck('Cancel + Save buttons', picker.includes('Cancel') && picker.includes('Save'));

// Repeat contextual labels
ck('repeatOptionsFor derives weekday/ordinal',
  dates.includes('Every week') && dates.includes('ordinal(') &&
  dates.includes('Every year') && dates.includes('Every weekday'));
ck('yearly in Recurrence union', readFileSync('src/types/index.ts', 'utf8').includes("'yearly'"));

// Continuous calendar
ck('monthSequence used', picker.includes('monthSequence('));
ck('scroll-spy header', picker.includes('data-month') && picker.includes('onCalScroll'));
ck('today jump ○', picker.includes('Jump to today'));

// Rules
ck('repeat forces date', picker.includes('next.dateKey = today'));
ck('no-date clears extras', picker.includes('next.durationMin = null'));

// Composer passes durationMin
ck('composer sends durationMin', composer.includes('durationMin'));

// CSS present
ck('css v3 blocks', css.includes('.todo-datepicker--v3') && css.includes('.tdp-repeat') && css.includes('.tdp-form'));

// Popover clipping fix
ck('no hardcoded upward anchor', !css.match(/todo-datepicker\s*{[^}]*bottom:\s*calc\(100%/s));
ck('anchorRef prop exists', picker.includes('anchorRef'));
ck('flip + clamp logic', picker.includes('spaceBelow') && picker.includes('spaceAbove') && picker.includes('maxHeight'));
ck('reposition on resize/scroll', picker.includes("addEventListener('resize'") && picker.includes("addEventListener('scroll'"));
ck('topbar clearance respected', picker.includes('TOPBAR_CLEARANCE'));
ck('composer passes anchorRef', composer.includes('anchorRef={chipWrapRef}'));
ck('chip label from sel not default', !composer.match(/dateChipLabel\(\s*defaultDateKey/));

// Frontend builds (the real "does it open" gate before manual check)
try {
  execSync('npm run build', { stdio: 'pipe' });
  ck('frontend production build', true);
} catch (err) {
  console.error(err);
  ck('frontend production build', false);
}

console.log(fail === 0 ? '\n✅ DATE PICKER V3 STATIC CHECKS PASSED' : `\n❌ ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
