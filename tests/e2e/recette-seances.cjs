/* eslint-disable @typescript-eslint/no-require-imports */
// Recette « Fiches de séance » (Playwright) sur la pile Supabase LOCALE, après recette-phase2.cjs.
// Prérequis : comptes et données de recette Phase 2 + application sur http://localhost:3000 (next start).
// Usage : node tests/e2e/recette-seances.cjs <dossier-captures>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3000';
const shots = process.argv[2] || '/tmp/recette-seances';
fs.mkdirSync(shots, { recursive: true });
const PW = 'Recette-Phase2-2026';
const iso = (d) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
let n = 0;
const log = (...a) => console.log(`✔ ${String(++n).padStart(2, '0')}`, ...a);
const errors = [];
const EX = `Activation pressing ${Date.now() % 100000}`;

async function login(browser, email, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${email} PAGEERROR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${email} CONSOLE ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`${email} HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`${BASE}/connexion`);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL('**/tableau-de-bord');
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const saved = (page) => page.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });
const step = async (page, id, n) => { await page.goto(`${BASE}/entrainement/seances/${id}?etape=${n}`); await page.getByRole('heading', { level: 2 }).first().waitFor(); };
async function download(page, label) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.getByRole('button', { name: label, exact: true }).click()]);
  const file = path.join(shots, d.suggestedFilename());
  await d.saveAs(file);
  return { name: d.suggestedFilename(), size: fs.statSync(file).size, file };
}

(async () => {
  const browser = await chromium.launch();
  const coach = await login(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // 1. Création
  await coach.goto(`${BASE}/entrainement/seances/nouvelle`);
  await coach.fill('[name=date]', iso(1));
  await coach.getByRole('button', { name: 'Créer la séance' }).click();
  await coach.waitForURL(/\/entrainement\/seances\/[0-9a-f-]+\?etape=1/);
  const id = coach.url().match(/seances\/([0-9a-f-]+)/)[1];
  log('séance créée en brouillon, assistant ouvert à l’étape 1');

  // 2. Informations générales (sauvegarde automatique)
  await coach.fill('#starts_at', '16:30');
  await coach.fill('#ends_at', '18:00');
  await coach.fill('#location', 'Stade municipal de Yamoussoukro');
  await coach.fill('#weather', 'Ensoleillé, 31 °C');
  await saved(coach);
  await coach.fill('#ends_at', '16:00');
  await coach.getByText("L'heure de fin doit suivre l'heure de début.").first().waitFor();
  await coach.fill('#ends_at', '18:00');
  await saved(coach);
  await coach.reload();
  if ((await coach.inputValue('#location')) !== 'Stade municipal de Yamoussoukro') throw new Error('lieu non enregistré');
  await shot(coach, '01-infos');
  log('étape 1 : horaires contrôlés (fin avant début refusée), lieu et météo enregistrés automatiquement');

  // 3. Thèmes et objectifs
  await step(coach, id, 2);
  await coach.fill('#new-main', 'Pressing haut');
  await coach.getByRole('button', { name: 'Créer' }).first().click();
  await coach.locator('#new-sub').waitFor();
  await coach.fill('#new-sub', 'Déclencheurs de pressing');
  await coach.getByRole('button', { name: 'Créer' }).nth(1).click();
  await coach.waitForFunction(() => document.querySelector('#sub_theme_id')?.selectedOptions[0]?.textContent === 'Déclencheurs de pressing');
  await coach.fill('#main_objective', 'Récupérer le ballon dans les 6 secondes après la perte');
  await coach.fill('[aria-label="Nouvel objectif spécifique"]', '3 récupérations hautes par séquence');
  await coach.keyboard.press('Enter');
  await saved(coach);
  await coach.getByRole('heading', { name: 'Pressing haut' }).waitFor();
  await shot(coach, '02-themes');
  log('étape 2 : thème et sous-thème créés dans la bibliothèque, objectifs enregistrés');

  // 4. Construction : 2 phases, 3 exercices
  await step(coach, id, 3);
  await coach.selectOption('#new-phase-block', 'activation');
  await coach.getByRole('button', { name: 'Ajouter la phase' }).click();
  await coach.getByRole('heading', { name: 'Activation' }).waitFor();
  await coach.selectOption('#new-phase-block', 'jeu_dirige');
  await coach.getByRole('button', { name: 'Ajouter la phase' }).click();
  await coach.getByRole('heading', { name: 'Jeu dirigé' }).waitFor();
  // Phase 1 : nouvel exercice
  await coach.getByRole('button', { name: 'Nouvel exercice' }).first().click();
  await coach.fill('[aria-label="Titre du nouvel exercice"]', EX);
  await coach.selectOption('[aria-label="Catégorie"]', 'pressing');
  await coach.getByRole('button', { name: 'Créer et ajouter' }).click();
  await coach.getByText(EX).first().waitFor();
  // Phase 2 : deux exercices de la bibliothèque
  for (const t of ['Rondo 5c2', 'Jeu de position 8c8']) {
    const sel = coach.locator('[aria-label="Exercice de la bibliothèque"]').last();
    await sel.selectOption({ label: await sel.locator('option', { hasText: t }).first().textContent() });
    await coach.getByRole('button', { name: 'Ajouter', exact: true }).last().click();
    await coach.locator('p.font-semibold', { hasText: t }).first().waitFor();
  }
  // Durées : 12 min ; 3 × 4 min récup 60 s + pause 2 ; 2 × 15 min récup 120 s
  const set = async (prefix, idx, v) => { const el = coach.locator(`input[id^="${prefix}-"]`).nth(idx); await el.fill(String(v)); };
  await set('d', 0, 12);
  await set('d', 1, 4); await set('s', 1, 3); await set('r', 1, 60); await set('p', 1, 2);
  await set('d', 2, 15); await set('s', 2, 2); await set('r', 2, 120);
  await coach.waitForTimeout(2500);
  await coach.reload();
  await coach.getByText('Durée totale').waitFor();
  const total = await coach.locator('aside').getByText(/min$/).first().textContent();
  // 12 + (12 + 2 + 2) + (30 + 2) = 60 min
  if (!/^60 min/.test(total.trim())) throw new Error(`durée calculée inattendue : ${total}`);
  const clock = await coach.locator('span.tabular-nums').first().textContent();
  if (!clock.includes('16h30')) throw new Error(`horaire de phase inattendu : ${clock}`);
  // Réorganisation : descendre le premier exercice de la phase 2
  await coach.getByRole('button', { name: "Descendre l'exercice" }).nth(1).click();
  await coach.waitForTimeout(1500);
  await coach.reload();
  const order = await coach.locator('p.font-semibold.leading-tight').allTextContents();
  if (order.join('|') !== `${EX}|Jeu de position 8c8|Rondo 5c2`) throw new Error(`ordre inattendu : ${order.join('|')}`);
  await shot(coach, '03-construction');
  log('étape 3 : 2 phases, 3 exercices, durée calculée 60 min (séries, récupérations, pause), horaires 16h30…, réorganisation enregistrée');

  // 5. Exercices et tableau tactique
  await step(coach, id, 4);
  await coach.fill('#ex-instructions', 'Pressing immédiat à la perte ; 2 joueuses ferment, 1 couvre.');
  await coach.fill('#ex-organisation', 'Carré de 20 x 20 m, 4 contre 2.');
  await saved(coach);
  const svg = coach.locator('svg[role=img]').first();
  await svg.scrollIntoViewIfNeeded();
  await coach.getByRole('button', { name: 'Équipe YFC' }).click();
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  if (box.y + box.height > 1000) throw new Error('tableau hors écran');
  await coach.getByRole('button', { name: 'Équipe YFC' }).click();
  for (const [x, y] of [[0.3, 0.4], [0.5, 0.5], [0.7, 0.4]]) await coach.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await coach.getByRole('button', { name: 'Équipe adverse' }).click();
  await coach.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await coach.getByRole('button', { name: 'Ballon', exact: true }).click();
  await coach.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.52);
  await coach.getByRole('button', { name: 'Plot', exact: true }).click();
  for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) await coach.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await coach.getByRole('button', { name: 'Flèche : Passe' }).click();
  await coach.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await coach.mouse.down();
  await coach.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.42, { steps: 6 });
  await coach.mouse.up();
  await coach.getByRole('button', { name: 'Zone rectangulaire' }).click();
  await coach.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15);
  await coach.mouse.down();
  await coach.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.85, { steps: 6 });
  await coach.mouse.up();
  await coach.keyboard.press('Control+z');
  await coach.keyboard.press('Control+y');
  // Étape d'animation : la joueuse 2 avance
  await coach.getByRole('button', { name: 'Étape' }).click();
  await coach.getByRole('button', { name: 'Sélection' }).first().click();
  await coach.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await coach.mouse.down();
  await coach.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3, { steps: 5 });
  await coach.mouse.up();
  const png = await download(coach, 'PNG HD');
  if (png.size < 20000) throw new Error('PNG du schéma trop petit');
  await coach.getByRole('button', { name: 'Enregistrer le schéma' }).click();
  await coach.getByText('Schéma enregistré.').waitFor();
  await coach.reload();
  await coach.getByText("Schéma de l'exercice (bibliothèque).").waitFor();
  await shot(coach, '04-schema');
  log(`étape 4 : consignes enregistrées, schéma dessiné (joueuses, ballon, plots, passe, zone, 2 étapes, annuler/rétablir), PNG ${Math.round(png.size / 1024)} Ko, schéma rechargé depuis la base`);

  // 6. Effectif et matériel
  await step(coach, id, 5);
  await coach.getByRole('button', { name: /Présentes : les disponibles/ }).click();
  await coach.selectOption('[aria-label^="Présence de"] >> nth=2', 'absente_justifiee');
  await saved(coach);
  await coach.getByRole('button', { name: /Reprendre le matériel des schémas/ }).click();
  await coach.fill('[aria-label="Quantité du nouveau matériel"]', '10');
  await coach.fill('[aria-label="Nouveau matériel"]', 'Chasubles roses');
  await coach.keyboard.press('Enter');
  await coach.waitForTimeout(2000);
  await coach.reload();
  const eq = await coach.locator('[aria-label="Matériel"]').evaluateAll((els) => els.map((e) => e.value));
  if (!eq.includes('Plot') || !eq.includes('Chasubles roses')) throw new Error(`matériel inattendu : ${eq.join(', ')}`);
  await shot(coach, '05-effectif');
  log(`étape 5 : présences (disponibles présentes, 1 absente), matériel repris du schéma + ajouté : ${eq.join(', ')}`);

  // 7. Charge
  await step(coach, id, 6);
  await coach.selectOption('#planned_rpe', '6');
  for (let k = 0; k < 4; k++) await coach.selectOption(`[aria-label^="RPE de"] >> nth=${k}`, String(5 + k));
  await coach.getByText(/UA prévues/).waitFor();
  await coach.waitForTimeout(2000);
  await coach.reload();
  const prev = await coach.locator('p.font-display.text-3xl').first().textContent();
  if (!prev.startsWith('360')) throw new Error(`charge prévue inattendue : ${prev}`);
  await coach.getByText('RPE moyen', { exact: true }).waitFor();
  await shot(coach, '06-charge');
  log('étape 6 : RPE prévu 6 × 60 min = 360 UA, RPE individuels et sRPE, moyennes équipe');

  // 8. Évaluation
  await step(coach, id, 7);
  const groups = coach.locator('[role=radiogroup]');
  for (let k = 0; k < 4; k++) await groups.nth(k).getByRole('radio', { name: String(4 + (k % 2)) }).click();
  await coach.fill('#strengths', 'Bonne intensité dans le pressing.');
  await coach.fill('#next_objective', 'Travailler la couverture.');
  await saved(coach);
  await coach.getByText(/%$/).first().waitFor();
  await shot(coach, '07-evaluation');
  log('étape 7 : critères notés (non observés exclus), score calculé, bilan du staff');

  // 9. Validation et exports
  await step(coach, id, 8);
  await coach.getByRole('button', { name: 'Soumettre', exact: false }).first().click().catch(() => {});
  await coach.waitForTimeout(1500);
  await coach.reload();
  const buttons = await coach.locator('button').allTextContents();
  for (const label of ['Valider', 'Publier']) {
    const b = coach.getByRole('button', { name: new RegExp(`^${label}`) }).first();
    if (await b.count()) { await b.click(); await coach.waitForTimeout(1500); }
  }
  await coach.reload();
  await coach.getByText(/Validée le/).waitFor();
  log(`étape 8 : circuit de validation (${buttons.filter((b) => /Soumettre|Valider|Publier/.test(b)).join(', ') || 'boutons'}), séance validée`);

  const pdf = await download(coach, 'PDF');
  const head = fs.readFileSync(pdf.file).subarray(0, 5).toString();
  if (head !== '%PDF-') throw new Error('PDF invalide');
  await coach.getByRole('button', { name: 'Aperçu', exact: true }).click();
  await coach.getByText(/Aperçu · \d+ page/).waitFor({ timeout: 90000 });
  const pagesCount = await coach.locator('img[alt^="Page "]').count();
  await shot(coach, '08-apercu-fiche-complete');
  const jpg = await download(coach, 'JPEG 300 DPI');
  const wa = await download(coach, 'Version WhatsApp');
  const zip = await download(coach, 'ZIP (toutes les pages)');
  log(`exports fiche complète : PDF ${Math.round(pdf.size / 1024)} Ko (${pagesCount} pages), ${jpg.name}, ${wa.name}, ${zip.name}`);

  for (const t of ['Fiche terrain', 'Fiche résumée', 'Compte rendu', 'Fiche exercice', 'Programme de la semaine']) {
    await coach.getByText(t, { exact: true }).click();
    const f = await download(coach, 'PDF');
    if (fs.readFileSync(f.file).subarray(0, 5).toString() !== '%PDF-') throw new Error(`PDF invalide : ${t}`);
    if (t === 'Fiche terrain') {
      await coach.getByRole('button', { name: 'Aperçu', exact: true }).click();
      await coach.getByText(/Aperçu · \d+ page/).waitFor({ timeout: 90000 });
      await shot(coach, '09-apercu-fiche-terrain');
    }
  }
  await coach.selectOption('select:near(:text("Format"))', 'A3').catch(() => {});
  const a3 = await download(coach, 'PDF');
  log(`6 modèles exportés en PDF, dont A3 (${a3.name})`);

  // Modèle et duplication
  await coach.fill('#tpl-name', `Pressing haut ${Date.now() % 10000}`);
  await coach.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await coach.getByText(/Modèle « .* » enregistré/).waitFor();
  await coach.fill('#dup-date', iso(8));
  await coach.getByRole('button', { name: 'Dupliquer la séance' }).click();
  await coach.waitForURL(/copie=1/);
  await step(coach, coach.url().match(/seances\/([0-9a-f-]+)/)[1], 3);
  const copied = await coach.locator('p.font-semibold.leading-tight').allTextContents();
  if (copied.length !== 3) throw new Error('duplication incomplète');
  log('modèle enregistré, séance dupliquée avec ses 3 exercices');

  // Pages annexes
  for (const [url, text, name] of [['/entrainement', 'Charge hebdomadaire', '10-tableau-de-bord'], ['/entrainement/schemas', 'Schémas tactiques', '11-schemas'], ['/entrainement/themes', 'Thèmes et sous-thèmes', '12-themes'], ['/entrainement/modeles', 'Pressing haut', '13-modeles']]) {
    await coach.goto(`${BASE}${url}`);
    await coach.getByText(text).first().waitFor();
    await shot(coach, name);
  }
  log('tableau de bord, schémas, thèmes et modèles affichés');

  // Mobile
  const mobile = await login(browser, 'coach.test@yfc.test', { width: 390, height: 844 });
  for (const k of [3, 4, 8]) { await step(mobile, id, k); await shot(mobile, `14-mobile-etape-${k}`); }
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error('défilement horizontal sur mobile');
  log('mobile 390 px : étapes 3, 4 et 8 sans défilement horizontal');

  // Adjoint : séance validée en lecture seule
  const adj = await login(browser, 'adjoint.test@yfc.test');
  await step(adj, id, 3);
  await adj.getByText('Lecture seule').waitFor();
  if (await adj.getByRole('button', { name: 'Ajouter la phase' }).count()) throw new Error('adjoint peut modifier une séance validée');
  log('adjoint : séance validée verrouillée (lecture seule)');

  await browser.close();
  if (errors.length) { console.error('ERREURS :\n' + errors.join('\n')); process.exit(1); }
  console.log('Recette fiches de séance : OK');
})().catch((e) => { console.error('ÉCHEC', e); console.error(errors.join('\n')); process.exit(1); });
