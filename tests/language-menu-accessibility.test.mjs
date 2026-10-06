import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source =
  readFileSync(
    'src/js/ag-language-menu.js',
    'utf8'
  );

test('custom language control refreshes accessible names', () => {
  assert.match(
    source,
    /const accessibleName\s*=/
  );

  assert.match(
    source,
    /select\.getAttribute\('aria-label'\)/
  );

  assert.match(
    source,
    /button\.setAttribute\('aria-label', accessibleName\)/
  );

  assert.match(
    source,
    /options\.setAttribute\('aria-label', accessibleName\)/
  );
});
