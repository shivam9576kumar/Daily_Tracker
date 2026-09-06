import { validateStriverGfgMapping } from '../src/utils/striverGfgValidator';

export { validateStriverGfgMapping };

if (require.main === module) {
  const result = validateStriverGfgMapping();
  console.log('==================================================');
  console.log('STRIVER GFG MAPPING VALIDATION REPORT');
  console.log('==================================================');
  console.log(`Total Striver Questions : ${result.totalQuestions}`);
  console.log(`TakeUForward Candidates : ${result.candidateCount}`);
  console.log(`Verified GFG Mappings   : ${result.mappedCount}`);
  console.log(`Unresolved Candidates   : ${result.unresolvedCount}`);
  console.log('--------------------------------------------------');

  if (!result.success) {
    console.error(`Validation FAILED with ${result.errors.length} error(s):`);
    result.errors.forEach((err, i) => console.error(`  ${i + 1}. ${err}`));
    process.exit(1);
  } else {
    console.log('Validation PASSED successfully!');
    process.exit(0);
  }
}
