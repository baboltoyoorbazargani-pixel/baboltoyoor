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
  const appZipUrl = installer.match(/\[string\]\$AppZipUrl = '([^']+)'/);
  assert.ok(appZipUrl, 'installer must define AppZipUrl');
  assert.match(appZipUrl[1], /^https:\/\/drive\.google\.com\/uc\?export=download&id=[A-Za-z0-9_-]+$/);
  assert.ok(installer.includes(`Babol Toyor ${version} - Windows Server`));
  assert.ok(read('public/index.html').includes(`id="releaseVersion" dir="ltr">${version}</span>`));
  assert.ok(read('CHANGELOG.md').includes(`نسخهٔ انتشار ${version}`));
  assert.ok(read('README.md').includes(`RELEASE-${version}-fa.md`));
  const setupCmd = read('windows-installer/BabolToyor-Setup.cmd');
  assert.ok(setupCmd.includes(`title Babol Toyor ${version} Setup - Windows Server 2025`));
  for (const guide of ['windows-installer/INSTALL-STEPS-fa.md', 'windows-installer/INSTALL-STEPS-fa.html']) {
    const content = read(guide);
    assert.match(content, /https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+/);
    assert.ok(content.includes(`BabolToyor-Windows-Setup-${version}.zip`));
    assert.ok(content.includes(`BabolToyor-Setup-${version}.cmd`));
    assert.ok(!content.includes('v37.43.0'));
  }
});
