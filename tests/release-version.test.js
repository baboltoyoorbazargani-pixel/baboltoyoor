'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
test('public release version, installer, UI and release notes stay in sync', () => {
  const version = read('RELEASE_VERSION.txt').trim();
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.ok(fs.existsSync(path.join(root,`RELEASE-${version}-fa.md`)));
  const installer = read('windows-installer/Install-BabolToyor.ps1');
  assert.ok(installer.includes(`/releases/download/v${version}/BabolToyor-App-${version}.zip`));
  assert.ok(installer.includes(`Babol Toyor ${version} - Windows Server`));
  assert.ok(read('public/index.html').includes(`id="releaseVersion" dir="ltr">${version}</span>`));
  assert.ok(read('CHANGELOG.md').includes(`نسخهٔ انتشار ${version}`));
});
