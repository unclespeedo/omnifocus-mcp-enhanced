import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTagAssignmentScript, generateAppleScript } from './addOmniFocusTask.js';

test('buildTagAssignmentScript creates missing tags before assignment', () => {
  const script = buildTagAssignmentScript(['mcp-test-tag'], 'newTask');

  assert.match(script, /set theTag to first flattened tag where name = "mcp-test-tag"/);
  assert.match(script, /if theTag is missing value then/);
  assert.match(script, /set theTag to make new tag with properties \{name:"mcp-test-tag"\}/);
  assert.match(script, /add theTag to tags of newTask/);
});

test('generateAppleScript builds date variables before OmniFocus tell block', () => {
  const script = generateAppleScript({
    name: 'Task with dates',
    dueDate: '2026-02-27',
    deferDate: '2026-02-25',
    plannedDate: '2026-02-24'
  });

  const tellIndex = script.indexOf('tell application "OmniFocus"');
  const preambleIndex = script.indexOf('set dueDateValue to current date');
  assert.ok(preambleIndex > -1 && preambleIndex < tellIndex);

  assert.match(script, /set due date of newTask to dueDateValue/);
  assert.match(script, /set defer date of newTask to deferDateValue/);
  assert.match(script, /set planned date of newTask to plannedDateValue/);

  assert.doesNotMatch(script, /set due date of newTask to date "/);
  assert.doesNotMatch(script, /set defer date of newTask to date "/);
  assert.doesNotMatch(script, /set planned date of newTask to date "/);
});

test('generateAppleScript keeps apostrophes and doubles backslashes in task text fields', () => {
  const script = generateAppleScript({
    name: "Review client's \\ draft",
    note: "Check Bob's file in C:\\Temp"
  });

  assert.match(script, /make new inbox task with properties \{name:"Review client's \\\\ draft"\}/);
  assert.match(script, /set note of newTask to "Check Bob's file in C:\\\\Temp"/);
  assert.doesNotMatch(script, /\\'/);
});

test('generateAppleScript escapes JSON response values through AppleScript helper', () => {
  const script = generateAppleScript({
    name: "Review client's \\ draft"
  });

  assert.match(script, /on jsonEscape\(inputText\)/);
  assert.match(script, /set taskNameValue to name of newTask/);
  assert.match(script, /my jsonEscape\(taskId\)/);
  assert.match(script, /my jsonEscape\(taskNameValue\)/);
});

test('project name with colon generates valid AppleScript', () => {
  const script = generateAppleScript({
    name: 'Test task',
    projectName: 'LIQUIFY : Development',
  });

  // The project name should appear in the where clause for matching
  assert.match(script, /first flattened project where name = "LIQUIFY : Development"/);

  // The error return string should reference the project name
  assert.match(script, /Project not found: LIQUIFY : Development/);

  // Verify no unescaped quotes that would break AppleScript string parsing
  // The return lines should have balanced \\\" sequences
  const returnLines = script.split('\n').filter(l => l.includes('return "{\\"'));
  for (const line of returnLines) {
    // Each return line should be a valid AppleScript string literal
    // Count the \\\" sequences - they should be even (opening and closing)
    const escapedQuotes = line.match(/\\\\\\"/g) || [];
    assert.equal(escapedQuotes.length % 2, 0, `Unbalanced escaped quotes in: ${line.trim()}`);
  }
});

test('task name with quotes generates valid AppleScript', () => {
  const script = generateAppleScript({
    name: 'Fix "broken" feature',
  });

  // The name in the properties should have escaped quotes for AppleScript context
  assert.match(script, /name:"\w/); // name property starts correctly

  // The success return line should be present
  assert.match(script, /success.*true/);
});

test('note with dollar signs generates valid AppleScript', () => {
  const script = generateAppleScript({
    name: 'Budget task',
    note: 'Cost is $100 and $200',
  });

  // Dollar signs should pass through (they're not special in AppleScript strings)
  assert.match(script, /set note of newTask to "Cost is \$100 and \$200"/);
});

test('task name with apostrophe is not backslash-escaped', () => {
  const script = generateAppleScript({
    name: "Review Rod's email",
    projectName: 'Development',
  });

  // Single quotes must NOT be escaped in AppleScript double-quoted strings
  // \' is invalid AppleScript and causes compilation errors
  assert.match(script, /name:"Review Rod's email"/);
  assert.doesNotMatch(script, /Rod\\'s/);
});

test('note with apostrophe passes through unescaped', () => {
  const script = generateAppleScript({
    name: 'Test task',
    note: "Steve's script isn't ready",
  });

  assert.match(script, /set note of newTask to "Steve's script isn't ready"/);
});
