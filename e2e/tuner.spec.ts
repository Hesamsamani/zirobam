import { test, expect, type Page } from '@playwright/test';

/** A microphone that is a 440 Hz tone: the page asks for the microphone and gets an oscillator. */
async function withFakeMicrophone(page: Page, frequency: number) {
  await page.addInitScript((hz) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = hz;
      const gain = context.createGain();
      gain.gain.value = 0.2;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      return destination.stream;
    };
  }, frequency);
}

test.describe('Tuner', () => {
  test('hears a 440 Hz tone as A4 within five cents', async ({ page }) => {
    await withFakeMicrophone(page, 440);
    await page.goto('/');
    await page.locator('#mainMenu [data-tile="tuner"]').click();
    await expect(page.locator('#tunerView')).toBeVisible();
    await page.locator('#tunerView .tn-toggle').click();
    await expect(page.locator('#tunerView .tn-toggle')).toHaveText('Stop');
    await expect(page.locator('#tunerView .tn-note')).toHaveText('A4', { timeout: 8000 });
    const hzText = (await page.locator('#tunerView .tn-hz').textContent())!;
    expect(Math.abs(1200 * Math.log2(parseFloat(hzText) / 440))).toBeLessThan(5);
    await expect(page.locator('#tunerView .tn-meter')).toHaveAttribute('data-tune', 'in');
    await page.locator('#tunerView .tn-toggle').click();
    await expect(page.locator('#tunerView .tn-toggle')).toHaveText('Start listening');
  });

  test('hears a tone a little sharp and says so', async ({ page }) => {
    await withFakeMicrophone(page, 440 * 2 ** (30 / 1200));
    await page.goto('/#/tuner');
    await page.locator('#tunerView .tn-toggle').click();
    await expect(page.locator('#tunerView .tn-cents')).toContainText('sharp', { timeout: 8000 });
    await expect(page.locator('#tunerView .tn-note')).toHaveText('A4');
  });

  test('says so when the microphone is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
      };
    });
    await page.goto('/#/tuner');
    await page.locator('#tunerView .tn-toggle').click();
    await expect(page.locator('#tunerView .tn-status')).toContainText('blocked');
  });

  test('fits the screen, in Persian too, with the meter left to right', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/tuner');
    await expect(page.locator('#tunerView .view-title')).toHaveText('کوک‌سنج');
    expect(await page.locator('#tunerView .tn-meter').getAttribute('dir')).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
