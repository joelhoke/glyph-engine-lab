// Run against a local Pages export: node scripts/verify-gallery-playgrounds.cjs [base URL]
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { chromium } = require('playwright-core')
const sharp = require('sharp')

const base = process.argv[2] || 'http://localhost:8788'
const projects = [
  ['neon-trip', 'Neon Trip'], ['loonz', 'Loonz'], ['darkwater', 'DarkWater'], ['gradient-bands', 'Gradient Bands'],
]
const qaDirectory = '/tmp/jh-gallery-qa'
const exact = name => ({ name, exact: true })
const button = (root, name) => root.getByRole('button', exact(name))
const group = (root, name) => root.getByRole('group', exact(name))
const option = (root, field, choice) => button(group(root, field), choice)
const combo = (root, name) => root.getByRole('combobox', exact(name))
const palette = (root, name) => root.locator('legend').filter({ hasText: new RegExp(`^${name}$`) })
  .locator('..').locator('input[type=color]').first()
const canvas = page => page.locator('[data-render-state] canvas').first()
const ready = root => root.locator('[data-render-state="ready"]').waitFor({ timeout: 45000 })
const pause = async page => {
  const toggle = button(page, 'Pause animation')
  if (await toggle.count()) await toggle.click()
  await button(page, 'Play animation').waitFor()
}
const reset = async page => { await button(page, 'Reset').click(); await ready(page) }
async function assertPressed(page, field, choice) {
  assert.equal(await option(page, field, choice).getAttribute('aria-pressed'), 'true', `${field}: ${choice} selected`)
}
async function stroke(page, points) {
  const art = canvas(page)
  await art.scrollIntoViewIfNeeded()
  const rect = await art.boundingBox()
  const project = ([x, y]) => [rect.x + x * rect.width, rect.y + y * rect.height]
  await page.mouse.move(...project(points[0]))
  await page.mouse.down()
  for (const point of points.slice(1)) await page.mouse.move(...project(point), { steps: 2 })
  await page.mouse.up()
}
async function cornerBrightness(page) {
  const pixels = await sharp(await canvas(page).screenshot()).extract({ left: 4, top: 4, width: 20, height: 20 }).raw().toBuffer()
  return pixels.reduce((sum, value) => sum + value, 0) / pixels.length
}

async function verifyTheme(page, slug) {
  // The first three expose editable background swatches. DarkWater shades its own backdrop.
  const background = palette(page, 'Background')
  if (slug === 'darkwater') {
    const light = await cornerBrightness(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForFunction(() => matchMedia('(prefers-color-scheme: dark)').matches)
    const dark = await cornerBrightness(page)
    assert(light - dark > 8, `DarkWater background switches with theme (${light.toFixed(1)} → ${dark.toFixed(1)})`)
    await page.emulateMedia({ colorScheme: 'light' })
    return
  }
  const light = await background.inputValue()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForFunction(({ selector, oldColor }) => {
    const input = [...document.querySelectorAll(selector)].find(el => el.closest('fieldset')?.querySelector('legend')?.textContent === 'Background')
    return input && input.value !== oldColor
  }, { selector: 'input[type=color]', oldColor: light })
  const dark = await background.inputValue()
  assert.notEqual(light, dark)
  const disclosure = background.locator('xpath=ancestor::details[1]')
  if (await disclosure.count() && !(await disclosure.evaluate(element => element.open))) {
    await disclosure.locator('summary').click()
  }
  await background.fill('#456789')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await background.inputValue(), '#456789', 'A custom background survives a theme change')
  await reset(page)
  assert.equal(await background.inputValue(), light, 'Reset restores the current theme background')
}

async function verifyNeon(page) {
  const undo = button(page, 'Undo')
  assert(await undo.isDisabled(), 'Opening or resetting starts a fresh edit history')
  const before = await canvas(page).screenshot()
  assert(before.equals(await canvas(page).screenshot()), 'Neon Trip holds its frame while paused')
  await assertPressed(page, 'Artwork', 'Shape')
  assert.equal(await group(page, 'Shape').getByRole('button').count(), 6, 'Six shape buttons are directly available')
  await option(page, 'Shape', 'Star').click()
  await assertPressed(page, 'Shape', 'Star')
  assert(!before.equals(await canvas(page).screenshot()), 'Selecting a star changes the artwork')
  await option(page, 'Artwork', 'Text').click()
  const input = page.getByLabel('Your text', { exact: true })
  const defaultText = await input.inputValue()
  await input.press('ControlOrMeta+a')
  await input.pressSequentially('PLAY')
  assert.equal(await input.inputValue(), 'PLAY')
  assert(!before.equals(await canvas(page).screenshot()), 'Text changes the artwork')
  await input.press('Control+z')
  assert.equal(await input.inputValue(), defaultText, 'The shortcut undoes a typing session in one step')
  await undo.click()
  await assertPressed(page, 'Artwork', 'Shape')
  await assertPressed(page, 'Shape', 'Star')
  await undo.click()
  await assertPressed(page, 'Shape', 'Circle')
  assert(await undo.isDisabled())

  const speed = page.getByRole('slider', exact('Speed'))
  const start = await speed.inputValue()
  await speed.scrollIntoViewIfNeeded()
  const box = await speed.boundingBox()
  const drag = async (from, to) => {
    await page.mouse.move(box.x + box.width * from, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * to, box.y + box.height / 2, { steps: 6 })
    await page.mouse.up()
  }
  await drag(.3, .65)
  const intermediate = await speed.inputValue()
  await drag(.65, .85)
  assert.notEqual(await speed.inputValue(), intermediate)
  await undo.click()
  assert.equal(await speed.inputValue(), intermediate, 'A second slider drag has its own undo step')
  await undo.click()
  assert.equal(await speed.inputValue(), start, 'One undo reverses the entire first drag')
  assert(await undo.isDisabled())
}

async function verifyLoonz(page) {
  const undo = button(page, 'Undo')
  const drawingColor = palette(page, 'Drawing color')
  const defaultColor = await drawingColor.inputValue()
  const presets = group(page, 'Add a balloon')
  const shapeNames = ['heart', 'circle', 'star', 'flower', 'blob']
  assert.deepEqual(await presets.getByRole('button').allTextContents(), ['Heart', 'Circle', 'Star', 'Flower', 'Blob'])
  assert.equal(await presets.locator('details, select').count(), 0, 'Shape actions are immediately available')
  await assertPressed(page, 'Canvas tool', 'Draw a balloon')
  const starterButtons = group(page, 'Selected balloon').getByRole('button')
  const starters = await starterButtons.allTextContents()
  assert.equal(starters.length, 4, 'Four starter balloons are exposed as buttons')
  const selectedBeforeDrawing = await group(page, 'Selected balloon').locator('[aria-pressed=true]').innerText()
  const foilColors = new Set()
  for (const name of starters) {
    await option(page, 'Selected balloon', name).click()
    foilColors.add(await palette(page, 'Balloon color').inputValue())
  }
  assert.equal(foilColors.size, 4, 'Each starter has a distinct foil color')
  await option(page, 'Selected balloon', selectedBeforeDrawing).click()
  assert(await undo.isDisabled(), 'Starting balloons and autonomous motion create no undo entries')
  await drawingColor.fill('#ff9966')
  const original = await canvas(page).screenshot()
  await stroke(page, Array.from({ length: 49 }, (_, i) => {
    const angle = i * Math.PI / 24
    return [.23 + Math.cos(angle) * .09, .44 + Math.sin(angle) * .12]
  }))
  const balloonList = combo(page, 'Selected balloon')
  const balloonOptions = balloonList.locator('option:not([value=""])')
  const selectedOption = balloonList.locator('option:checked')
  assert.equal(await balloonOptions.count(), 5, 'Drawing a fifth balloon switches the buttons to a select')
  assert(starters.includes(await balloonList.locator('option[value="starter-circle"]').innerText()), 'The circle is one of the four starters')
  assert.equal(await selectedOption.innerText(), 'Balloon 05')
  await assertPressed(page, 'Canvas tool', 'Draw a balloon')
  assert(!original.equals(await canvas(page).screenshot()), 'The outline inflated into the composition')
  assert.equal(await palette(page, 'Balloon color').inputValue(), '#ff9966', 'Foil inherits the selected drawing color')
  await button(presets, 'Add heart balloon').click()
  assert.equal(await balloonOptions.count(), 6)
  assert.equal(await selectedOption.innerText(), 'Heart 06')
  await assertPressed(page, 'Canvas tool', 'Draw a balloon')
  await page.locator('summary', { hasText: 'Fine-tune the balloon' }).click()
  const selectedColor = palette(page, 'Balloon color')
  assert.equal(await selectedColor.inputValue(), '#ff9966', 'One-click presets inherit the drawing color')
  await selectedColor.fill('#3366aa')
  const size = page.getByRole('slider', exact('Size'))
  const oldSize = await size.inputValue()
  await size.fill('1.35')
  await button(page, 'Remove selected balloon').click()
  assert.equal(await balloonOptions.count(), 5)
  await undo.click()
  assert.equal(await selectedOption.innerText(), 'Heart 06')
  assert.equal(await selectedColor.inputValue(), '#3366aa', 'Undo deletion restores the edited balloon')
  assert.equal(await size.inputValue(), '1.35')
  await undo.click()
  assert.equal(await size.inputValue(), oldSize, 'Undo restores the original size')
  await undo.click()
  assert.equal(await selectedColor.inputValue(), '#ff9966', 'Undo restores the previous foil color')
  await undo.click()
  assert.equal(await selectedOption.innerText(), 'Balloon 05')
  await option(page, 'Canvas tool', 'Grab & throw').click()
  const beforeMove = await canvas(page).screenshot()
  await stroke(page, [[.23, .44], [.26, .46], [.29, .48], [.32, .55]])
  assert.equal(await selectedOption.innerText(), 'Balloon 05', 'Dragging picks the drawn balloon')
  assert(!beforeMove.equals(await canvas(page).screenshot()), 'Dragging the drawn balloon changes its position')
  await undo.click()
  assert(beforeMove.equals(await canvas(page).screenshot()), 'Undo puts the balloon back where it was drawn')
  await assertPressed(page, 'Canvas tool', 'Grab & throw')
  await undo.click()
  assert.deepEqual(await starterButtons.allTextContents(), starters, 'Undo returns the four starters to buttons')
  await assertPressed(page, 'Selected balloon', selectedBeforeDrawing)
  await option(page, 'Canvas tool', 'Draw a balloon').click()
  await undo.click()
  assert.equal(await drawingColor.inputValue(), defaultColor)
  assert(await undo.isDisabled(), 'Undo reaches the original composition')

  const background = palette(page, 'Background')
  await background.fill('#4c6683')
  await page.emulateMedia({ colorScheme: 'dark' })
  await undo.click()
  const sectionColor = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-section-blue').trim())
  assert.equal(await background.inputValue(), await sectionColor(), 'Undo restores the dark site backdrop')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForFunction(el => el.value === getComputedStyle(document.documentElement).getPropertyValue('--color-section-blue').trim(),
    await background.elementHandle())
  const float = page.getByRole('slider', exact('Float amount'))
  const oldFloat = await float.inputValue()
  await float.fill('0.8')
  await undo.click()
  assert.equal(await float.inputValue(), oldFloat)
  await float.fill('0.75')
  await reset(page)
  assert(await undo.isDisabled(), 'Reset clears the undo history')

  await pause(page)
  for (let i = 0; i < 8; i++) {
    const name = shapeNames[i % shapeNames.length]
    await button(presets, `Add ${name} balloon`).click()
    assert.equal(await balloonOptions.count(), 5 + i, 'Each shape button adds one balloon')
    assert.equal(await selectedOption.innerText(), `${name[0].toUpperCase() + name.slice(1)} ${String(5 + i).padStart(2, '0')}`)
  }
  assert.equal(await presets.locator('button:disabled').count(), 5, 'All presets respect the twelve-balloon limit')
  for (let i = 0; i < 8; i++) await undo.click()
  assert.deepEqual(await starterButtons.allTextContents(), starters)
  assert.equal(await presets.locator('button:disabled').count(), 0)
  assert(await undo.isDisabled(), 'One undo per preset returns to the starter composition')
}

async function verifyBands(page) {
  const undo = button(page, 'Undo')
  const draw = option(page, 'Canvas tool', 'Draw a band')
  const move = option(page, 'Canvas tool', 'Select & move')
  const brush = palette(page, 'Brush colors')
  await assertPressed(page, 'Canvas tool', 'Draw a band')
  assert(await undo.isDisabled(), 'The starting study has no edits')
  const originalColor = await brush.inputValue()
  await brush.fill('#f19620')
  const initial = await canvas(page).screenshot()
  await stroke(page, [[.15, .3], [.45, .3], [.8, .3]])
  const drawn = await canvas(page).screenshot()
  assert(!initial.equals(drawn), 'Drawing adds the ribbon')
  await move.click()
  assert.equal(await palette(page, 'Band colors').inputValue(), '#f19620')
  await stroke(page, [[.45, .3], [.45, .35], [.47, .42], [.48, .47]])
  const moved = await canvas(page).screenshot()
  assert(!drawn.equals(moved), 'Dragging moves the ribbon')

  const width = page.getByRole('slider', exact('Width'))
  const originalWidth = await width.inputValue()
  await width.scrollIntoViewIfNeeded()
  const box = await width.boundingBox()
  await page.mouse.move(box.x + box.width * .45, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .78, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  const editedWidth = await width.inputValue()
  assert.notEqual(editedWidth, originalWidth)
  await button(page, 'Remove selected band').click()
  assert.equal(await group(page, 'Selected band').getByRole('button').count(), 1)
  await undo.click()
  assert.equal(await width.inputValue(), editedWidth, 'Undo removal restores the edited ribbon')
  await undo.click()
  assert.equal(await width.inputValue(), originalWidth, 'One undo restores the entire width gesture')
  assert(moved.equals(await canvas(page).screenshot()), 'Width restoration preserves the new position')
  await undo.click()
  assert(drawn.equals(await canvas(page).screenshot()), 'One undo restores the entire canvas drag')
  await undo.click()
  assert(initial.equals(await canvas(page).screenshot()), 'Undo drawing restores the original artwork')
  await assertPressed(page, 'Canvas tool', 'Select & move')
  await draw.click()
  await undo.click()
  assert.equal(await brush.inputValue(), originalColor)
  assert(await undo.isDisabled())

  await page.locator('summary', { hasText: 'Fine-tune the bands' }).click()
  const background = palette(page, 'Background')
  await background.fill('#456789')
  await combo(page, 'Starting point').selectOption({ label: 'Blank canvas' })
  assert(await move.isDisabled())
  await page.emulateMedia({ colorScheme: 'dark' })
  await undo.click()
  assert(await move.isEnabled(), 'Undo preset restores the sample ribbon')
  assert.equal(await background.inputValue(), '#456789', 'Undo preset restores the explicit background')
  await undo.click()
  assert.equal(await background.inputValue(), '#181624', 'Undo background follows the current system theme')
  assert(await undo.isDisabled())
  await page.emulateMedia({ colorScheme: 'light' })
}

async function verifyWater(page) {
  const undo = button(page, 'Undo')
  assert(await undo.isDisabled(), 'The starter scene has no undo history')
  await assertPressed(page, 'Canvas tool', 'Drop shapes')
  await option(page, 'Canvas tool', 'Select & move').click()
  const originals = await group(page, 'Selected shape').getByRole('button').allTextContents()
  assert.deepEqual(originals.map(label => label.split(' ')[0]).sort(), ['Cube', 'Pyramid', 'Sphere'])
  await option(page, 'Canvas tool', 'Drop shapes').click()
  await option(page, 'Shape', 'Pyramid').click()
  await button(page, 'Add shape').click()
  await option(page, 'Canvas tool', 'Select & move').click()
  assert.equal(await group(page, 'Selected shape').getByRole('button').count(), 4)
  assert.match(await group(page, 'Selected shape').locator('[aria-pressed=true]').innerText(), /Pyramid/)
  await button(page, 'Remove selected shape').click()
  assert.equal(await group(page, 'Selected shape').getByRole('button').count(), 3)
  await undo.click()
  assert.match(await group(page, 'Selected shape').locator('[aria-pressed=true]').innerText(), /Pyramid 4/)
  await undo.click()
  assert.deepEqual(await group(page, 'Selected shape').getByRole('button').allTextContents(), originals)
  assert(await undo.isDisabled(), 'Tool and shape choices leave the edited scene history intact')

  await option(page, 'View', 'Overhead').click()
  await option(page, 'Canvas tool', 'Drop shapes').click()
  await option(page, 'Shape', 'Sphere').click()
  const art = canvas(page)
  await art.scrollIntoViewIfNeeded()
  let box = await art.boundingBox()
  await art.click({ position: { x: box.width * .625, y: box.height * .5 }, delay: 400 })
  await page.getByRole('status').filter({ hasText: '4 shapes in the water' }).waitFor({ state: 'attached' })
  await option(page, 'Canvas tool', 'Select & move').click()
  await option(page, 'Selected shape', 'Cube 1').click()
  const placed = await art.screenshot()
  box = await art.boundingBox()
  await page.mouse.move(box.x + box.width * .625, box.y + box.height * .5)
  await page.mouse.down()
  // Wait for the GPU pick before completing the drag.
  await group(page, 'Selected shape').locator('button[aria-pressed=true]').filter({ hasText: 'Sphere 5' }).waitFor()
  await page.mouse.move(box.x + box.width * .70, box.y + box.height * .46, { steps: 4 })
  await page.mouse.up()
  // A completed pointer event can precede presentation of the next WebGL frame.
  async function expectPlacedFrame(matches, message) {
    const deadline = Date.now() + 5000
    do {
      if (placed.equals(await art.screenshot()) === matches) return
    } while (Date.now() < deadline)
    assert.fail(message)
  }
  await expectPlacedFrame(false, 'Dragging moves the shape across the paused scene')
  await undo.click()
  await expectPlacedFrame(true, 'Undo restores the position before the drag')

  await page.locator('summary', { hasText: 'Fine-tune the scene' }).click()
  await button(page, 'Clear shapes').click()
  await page.getByText('Choose Drop shapes to add a shape to the water.').waitFor()
  await undo.click()
  await assertPressed(page, 'Selected shape', 'Cube 1')
  await undo.click()
  assert.deepEqual(await group(page, 'Selected shape').getByRole('button').allTextContents(), originals)
  await undo.click()
  await assertPressed(page, 'View', 'Surface')

  const light = palette(page, 'Light colors')
  const originalLight = await light.inputValue()
  const strength = page.getByRole('slider', exact('Wave strength'))
  const originalStrength = await strength.inputValue()
  await light.fill('#33aa99')
  await strength.press('ArrowRight')
  assert.notEqual(await strength.inputValue(), originalStrength)
  await undo.click()
  assert.equal(await strength.inputValue(), originalStrength)
  assert.equal(await light.inputValue(), '#33aa99')
  await undo.click()
  assert.equal(await light.inputValue(), originalLight)
  assert(await undo.isDisabled(), 'Every scene edit was undone')
  await option(page, 'View', 'Underwater').click()
  await assertPressed(page, 'View', 'Underwater')
  await option(page, 'Canvas tool', 'Make ripples').click()
  await button(page, 'Play animation').click()
  await canvas(page).click({ position: { x: 200, y: 150 } })
  await ready(page)
  const studio = page.getByRole('link', exact('Open full studio'))
  assert.equal((await page.request.get(new URL(await studio.getAttribute('href'), base).href)).status(), 200)
}

async function verifyGallery(page) {
  await page.goto(`${base}/gallery`)
  const surface = page.getByRole('region', exact('Explore gallery'))
  await surface.waitFor()
  assert.equal(await surface.getByText(/^[+↗]$/).count(), 0, 'Sphere tiles omit decorative corner icons')
  await surface.focus()
  const originalX = await surface.getAttribute('data-x')
  await surface.press('ArrowRight')
  await page.waitForFunction(x => document.querySelector('[aria-label="Explore gallery"]').dataset.x !== x, originalX)
  await button(page, 'Grid view').click()
  const grid = page.getByRole('list', exact('All gallery works'))
  await grid.waitFor()
  assert.equal(await grid.getByText(/^[+↗]$/).count(), 0, 'Grid tiles omit decorative corner icons')
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme })
    for (const [slug, title] of [...projects, ['droplet', 'Droplet']]) {
      const tile = grid.locator(`a[href="/gallery/${slug}"]`)
      const name = theme === 'dark' ? `${slug}-dark` : slug
      const posterPath = slug === 'droplet' ? '/assets/gallery/previews/droplet.webp' : `/assets/gallery/${name}.webp`
      const videoPath = `/assets/gallery/previews/${slug === 'droplet' ? 'droplet-gameplay' : name}.mp4`
      await tile.hover()
      await page.waitForFunction(({ slug, posterPath, videoPath }) => {
        const tile = document.querySelector(`ul a[href="/gallery/${slug}"]`)
        const image = tile?.querySelector('img'), video = tile?.querySelector('video')
        return image?.complete && image.naturalWidth > 0 &&
          new URL(image.currentSrc).pathname === posterPath &&
          video?.readyState >= 2 && !video.paused && video.currentTime > 0.12 &&
          new URL(video.currentSrc).pathname === videoPath &&
          Number(getComputedStyle(video).opacity) > 0.9
      }, { slug, posterPath, videoPath }, { timeout: 12000 })
      console.log(`PASS: ${title} ${theme} poster and visible hover clip`)
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const droplet = grid.locator('a[href="/gallery/droplet"]')
  await droplet.hover()
  await droplet.locator('video').waitFor({ state: 'detached' })
  assert(await droplet.locator('img').isVisible(), 'Droplet keeps its poster when motion is reduced')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  for (const [slug, title] of projects) {
    const tile = grid.locator(`a[href="/gallery/${slug}"]`)
    assert.equal(await tile.count(), 1, `Listed ${title} once`)
    await tile.scrollIntoViewIfNeeded()
    await tile.locator('img').evaluate(image => image.decode())
    await tile.click()
    const dialog = page.getByRole('dialog', exact(title))
    await dialog.waitFor()
    const iframe = dialog.locator('iframe')
    assert.equal(await iframe.getAttribute('src'), `/gallery/${slug}?gallery-embed=1`)
    const content = iframe.contentFrame()
    await ready(content)
    await content.locator('[data-embedded=true]').waitFor()
    if (slug === 'loonz') {
      const add = button(content, 'Add star balloon')
      await add.click()
      assert.equal(await combo(content, 'Selected balloon').locator('option:checked').innerText(), 'Star 05')
      await add.press('Meta+z')
      assert.equal(await group(content, 'Selected balloon').getByRole('button').count(), 4)
      assert(await button(content, 'Undo').isDisabled(), 'The gallery window handles its own undo shortcut')
    }
    await button(dialog, 'Close preview').click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(new URL(page.url()).pathname, '/gallery')
  }
  await button(page, 'Explore').click()
  await surface.waitFor()
  await page.screenshot({ path: `${qaDirectory}/gallery.png` })
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' })
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => { if (msg.type() === 'error' && /shader|worker|WebGL|hydration|Minified React/i.test(msg.text())) errors.push(msg.text()) })
    const checks = { 'neon-trip': verifyNeon, loonz: verifyLoonz, darkwater: verifyWater, 'gradient-bands': verifyBands }
    await fs.mkdir(qaDirectory, { recursive: true })
    for (const [slug, title] of projects) {
      console.log(`Checking ${title}`)
      await page.goto(`${base}/gallery/${slug}`); await ready(page); await pause(page)
      assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), title)
      const firstColor = page.locator('input[type=color]').first()
      const original = await firstColor.inputValue()
      await firstColor.fill('#ee2266')
      assert.equal(await firstColor.inputValue(), '#ee2266')
      await reset(page)
      assert.equal(await firstColor.inputValue(), original)
      await pause(page)
      await checks[slug](page)
      await reset(page); await pause(page)
      await verifyTheme(page, slug)
      console.log(`PASS: ${title} rendering, choices, gestures, reset, and theme`)
    }
    await verifyGallery(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
    for (const slug of [...projects.map(([slug]) => slug), 'three-gradient']) {
      await page.goto(`${base}/gallery/${slug}`); await ready(page)
      await button(page, 'Play animation').waitFor()
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow')
      await reset(page)
      if (slug !== 'three-gradient') {
        const control = page.locator('aside[aria-label="Playground controls"]').getByRole('button').first()
        await control.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
        assert(await control.evaluate(el => {
          const rect = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
        }), `${slug} mobile controls are reachable`)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `${qaDirectory}/${slug}-mobile.png`, fullPage: true })
    }
    assert.deepEqual(errors, [], 'Browser, hydration, shader, or worker errors')
    console.log('PASS: sphere navigation, project dialogs, mobile layout, and reduced motion')
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
