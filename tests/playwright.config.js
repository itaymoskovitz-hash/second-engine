// UI tests for the built site in docs/. Supabase, Google and the AI function are stubbed; nothing leaves the machine.
const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
  testDir: './specs',
  timeout: 60000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8765/',
    viewport: {width: 390, height: 844},
    timezoneId: 'Asia/Jerusalem',
    serviceWorkers: 'allow',
    launchOptions: process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {}
  },
  webServer: {command: 'python3 -m http.server 8765 --directory ../docs', port: 8765, reuseExistingServer: true}
});
