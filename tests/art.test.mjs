import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_IDS } from '../js/data.js';
import { unitArt, wizardArt } from '../js/characters.js';

test('every character renderer returns valid SVG without undefined values', () => {
  for (const unitId of UNIT_IDS) {
    const markup = unitArt(unitId, { decorative: true });
    assert.equal(typeof markup, 'string');
    assert.match(markup, /^<svg/);
    assert.ok(!markup.includes('undefined'), `${unitId} contains undefined in SVG markup`);
  }
});

test('wizard renderer returns SVG without undefined values', () => {
  const markup = wizardArt();
  assert.match(markup, /^<svg/);
  assert.ok(!markup.includes('undefined'));
});

test('unknown characters receive a visible fallback instead of undefined', () => {
  const markup = unitArt('missing-character');
  assert.equal(typeof markup, 'string');
  assert.ok(markup.length > 0);
  assert.ok(!markup.includes('undefined'));
});
