import assert from 'node:assert/strict';
import test from 'node:test';
import { resetDailySection } from '../src/checklist.mjs';

test('resets checked tasks only within the Daily section', () => {
  const before = `# Daily
- [x] Exercise
- [X] Vitamins
- [ ] Read

## Morning
1. [x] Coffee

# Other
- [x] Renew passport`;

  const expected = `# Daily
- [ ] Exercise
- [ ] Vitamins
- [ ] Read

## Morning
1. [ ] Coffee

# Other
- [x] Renew passport`;

  assert.deepEqual(resetDailySection(before), { content: expected, resetCount: 3 });
});

test('supports multiple Daily sections and preserves unrelated content', () => {
  const before = 'Intro\n## DAILY ##\n* [x] One\n## Later\n- [x] Keep\n# Daily\n+ [X] Two\n';
  const expected = 'Intro\n## DAILY ##\n* [ ] One\n## Later\n- [x] Keep\n# Daily\n+ [ ] Two\n';
  assert.deepEqual(resetDailySection(before), { content: expected, resetCount: 2 });
});

test('does nothing without a Daily heading', () => {
  const content = '# Tasks\n- [x] Leave this checked';
  assert.deepEqual(resetDailySection(content), { content, resetCount: 0 });
});
