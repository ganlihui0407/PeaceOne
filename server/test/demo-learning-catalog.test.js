import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMO_LEARNING_COURSES } from '../src/lib/demoLearningCatalog.js';

const SUBSTRING_TRAPS = ['React', 'REST', 'API', 'UI', 'SEO'];

test('demo courses pin exact ESCO labels and avoid substring traps', () => {
  assert.equal(DEMO_LEARNING_COURSES.length, 15);
  for (const course of DEMO_LEARNING_COURSES) {
    assert.ok(Array.isArray(course.skillLabels), course.slug);
    assert.equal(course.skillLabels.length >= 1, true, course.slug);
    assert.equal(course.skillLabels.length <= 3, true, course.slug);
    for (const label of course.skillLabels) {
      assert.equal(typeof label, 'string');
      assert.equal(label.trim(), label);
      assert.equal(SUBSTRING_TRAPS.includes(label), false, `${course.slug} ${label}`);
    }
  }
});
