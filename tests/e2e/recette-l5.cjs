/* eslint-disable @typescript-eslint/no-require-imports */
// Recette « Phase 3 · Livraison 5 » (Playwright) sur la pile Supabase LOCALE.
// Tableau tactique (noms des joueuses, étapes, PDF de toutes les étapes), coups de pied arrêtés, droits, mobile.
// Usage : node tests/e2e/recette-l5.cjs <dossier-captures>
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const shots = process.argv[2] || '/tmp/recette-l5';
fs.mkdirSync(shots, { recursive: true });
const PW = 'Recette-Phase2-2026';
let n = 0;
const log = (...a) => console.log(`✔ ${String(++n).padStart(2, '0')}`, ...a);
const errors = [];
const sql = (q) => execSync(`psql ${DB} -Atqc "${q}"`).toString().trim();

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
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const saved = (page) => page.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });

async function board(page) {
  const svg = page.locator('svg[role=img][aria-label^="Schéma tactique"]').first();
  await svg.scrollIntoViewIfNeeded();
  return svg.boundingBox();
}
async function placeNamedPlayer(page, box, x, y, optionIndex) {
  await page.getByRole('button', { name: 'Équipe YFC' }).click();
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  const sel = page.getByLabel("Joueuse de l'effectif");
  const value = await sel.locator('option').nth(optionIndex).getAttribute('value');
  await sel.selectOption(value);
  return (await sel.locator(`option[value="${value}"]`).innerText()).split(' · ').pop();
}

(async () => {
  sql("delete from public.set_piece_routines where name ilike '%recette%'");
  sql("delete from public.tactical_diagrams where title ilike '%recette L5%'");
  const browser = await chromium.launch();
  const coach = await login(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // 1. Tableau tactique depuis le menu
  await coach.getByRole('link', { name: 'Tableau tactique' }).first().click();
  await coach.waitForURL('**/entrainement/schemas/nouveau');
  await coach.getByLabel('Titre du schéma').fill('Sortie de balle recette L5');
  let box = await board(coach);
  const n1 = await placeNamedPlayer(coach, box, 0.3, 0.6, 1);
  const n2 = await placeNamedPlayer(coach, box, 0.6, 0.5, 2);
  must(await coach.locator('svg[role=img] text', { hasText: n1 }).count() >= 1, `nom ${n1} absent du pion`);
  await coach.getByRole('button', { name: 'Ballon', exact: true }).click();
  await coach.mouse.click(box.x + box.width * 0.32, box.y + box.height * 0.62);
  await coach.getByRole('button', { name: 'Flèche : Passe' }).click();
  await coach.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await coach.mouse.down();
  await coach.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.5, { steps: 6 });
  await coach.mouse.up();
  await coach.getByRole('button', { name: 'Étape' }).click();
  await coach.getByRole('button', { name: 'Sélection' }).first().click();
  await coach.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await coach.mouse.down();
  await coach.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 5 });
  await coach.mouse.up();
  await coach.getByRole('button', { name: 'Enregistrer le schéma' }).click();
  await coach.waitForURL(/\/entrainement\/schemas\/[0-9a-f-]{36}$/);
  const diagramId = coach.url().split('/').pop();
  const stored = sql(`select data::text from public.tactical_diagrams where id = '${diagramId}'`);
  must(stored.includes(n1) && stored.includes(n2), 'noms des joueuses non enregistrés dans le schéma');
  await shot(coach, '01-tableau-tactique');
  log(`tableau tactique : 2 joueuses nommées (${n1}, ${n2}), ballon, passe, 2 étapes, enregistré`);

  // 2. PDF de toutes les étapes
  const [pdfPage] = await Promise.all([coach.context().waitForEvent('page'), coach.getByRole('link', { name: /PDF · toutes les étapes/ }).click()]);
  await pdfPage.waitForLoadState('networkidle');
  must(await pdfPage.getByText('Étape 1', { exact: true }).count() === 1 && await pdfPage.getByText('Étape 2', { exact: true }).count() === 1, 'PDF : étapes absentes');
  must(await pdfPage.locator('#document text', { hasText: n1 }).count() >= 2, 'PDF : nom absent sur les étapes');
  await shot(pdfPage, '02-schema-pdf');
  await pdfPage.close();
  log('version imprimable : toutes les étapes, noms visibles');

  // 3. Coups de pied arrêtés : création
  await coach.getByRole('link', { name: 'Coups de pied arrêtés' }).first().click();
  await coach.waitForURL('**/tactique/cpa');
  await coach.getByRole('button', { name: 'Nouvelle combinaison' }).click();
  await coach.getByLabel('Catégorie').selectOption('corner_off');
  await coach.getByLabel('Nom de la combinaison').fill('Corner rentrant recette');
  await coach.getByLabel('Côté').selectOption('droite');
  await coach.getByRole('button', { name: 'Créer et dessiner' }).click();
  await coach.waitForURL(/\/tactique\/cpa\/[0-9a-f-]{36}$/);
  const spId = coach.url().split('/').pop();
  log('combinaison créée (corner offensif, côté droit)');

  // 4. Fiche : signal, consignes, tireuses ordonnées, responsabilités
  await coach.getByPlaceholder(/main levée/).fill('Main levée');
  await coach.getByPlaceholder(/appel au 1er poteau/).fill('1) Appel 1er poteau pour fixer. 2) Ballon rentrant au point de penalty. 3) Seconde balle en retrait.');
  const add = coach.getByLabel('Ajouter une tireuse');
  await add.selectOption({ index: 1 });
  await add.selectOption({ index: 1 });
  await coach.getByRole('button', { name: 'Monter' }).nth(1).click();
  await coach.getByRole('button', { name: 'Ajouter une responsabilité' }).click();
  await coach.getByLabel('Joueuse de la responsabilité 1').selectOption({ index: 3 });
  await coach.getByLabel('Rôle 1').fill('Bloc sur la gardienne');
  await coach.getByRole('button', { name: 'Ajouter une responsabilité' }).click();
  await coach.getByLabel('Rôle 2').fill('Zone entrée de surface (seconde balle)');
  await saved(coach);
  await coach.waitForTimeout(1500);
  const row = sql(`select signal || '|' || cardinality(takers) || '|' || jsonb_array_length(responsibilities) from public.set_piece_routines where id = '${spId}'`);
  must(row === 'Main levée|2|2', `fiche CPA mal enregistrée : ${row}`);
  log('fiche : signal, consignes, 2 tireuses réordonnées, 2 responsabilités (enregistrement automatique)');

  // 5. Schéma animé de la combinaison
  box = await board(coach);
  await placeNamedPlayer(coach, box, 0.5, 0.5, 1);
  await coach.getByRole('button', { name: 'Ballon', exact: true }).click();
  await coach.mouse.click(box.x + box.width * 0.97, box.y + box.height * 0.05);
  await coach.getByRole('button', { name: 'Étape' }).click();
  await coach.getByRole('button', { name: 'Enregistrer le schéma' }).click();
  await coach.getByText('Schéma enregistré.').waitFor();
  await coach.reload();
  const frames = sql(`select jsonb_array_length(diagram->'frames') || '|' || jsonb_array_length(diagram->'items') from public.set_piece_routines where id = '${spId}'`);
  must(frames === '2|2', `schéma CPA non enregistré : ${frames}`);
  must(sql(`select count(*) from public.tactical_diagrams where title = 'Corner rentrant recette'`) === '0', 'le schéma CPA a été copié dans la bibliothèque');
  await shot(coach, '03-cpa-fiche');
  log('schéma animé enregistré dans la combinaison (pas de copie dans la bibliothèque)');

  // 6. Liste groupée et carnet imprimable
  await coach.goto(`${BASE}/tactique/cpa`);
  const group = coach.getByRole('region', { name: 'Corners offensifs' });
  must(await group.getByText('Corner rentrant recette').count() === 1, 'combinaison absente de la liste');
  must(await group.getByText(/Signal : Main levée/).count() === 1, 'signal absent de la carte');
  await shot(coach, '04-cpa-liste');
  await coach.goto(`${BASE}/impression/cpa`);
  must(await coach.getByText('Corner rentrant recette').count() >= 1 && await coach.getByText('Bloc sur la gardienne', { exact: false }).count() === 1, 'carnet incomplet');
  await shot(coach, '05-carnet-cpa');
  await coach.goto(`${BASE}/impression/cpa?id=${spId}`);
  must(await coach.getByText('Zone entrée de surface (seconde balle)', { exact: false }).count() === 1, 'fiche imprimable incomplète');
  log('liste groupée par catégorie, carnet et fiche imprimables');

  // 7. Dupliquer, archiver, restaurer, supprimer
  await coach.goto(`${BASE}/tactique/cpa/${spId}`);
  await coach.getByRole('button', { name: 'Dupliquer' }).first().click();
  await coach.waitForURL((u) => /\/tactique\/cpa\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(spId));
  const copyId = coach.url().split('/').pop();
  must(sql(`select cardinality(takers) from public.set_piece_routines where id = '${copyId}'`) === '2', 'copie incomplète');
  await coach.getByRole('button', { name: 'Archiver' }).click();
  await coach.getByText('Combinaison archivée.').waitFor();
  await coach.goto(`${BASE}/tactique/cpa?archives=1`);
  must(await coach.getByText('Corner rentrant recette (copie)').count() === 1, 'archive absente');
  await coach.goto(`${BASE}/tactique/cpa/${copyId}`);
  await coach.getByRole('button', { name: 'Restaurer' }).click();
  await coach.getByRole('button', { name: 'Archiver' }).waitFor();
  await coach.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await coach.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await coach.waitForURL('**/tactique/cpa');
  must(sql(`select count(*) from public.set_piece_routines where id = '${copyId}'`) === '0', 'copie non supprimée');
  log('dupliquer, archiver, restaurer, supprimer (confirmation en deux temps)');

  // 8. Droits
  const adj = await login(browser, 'adjoint.test@yfc.test');
  await adj.goto(`${BASE}/tactique/cpa/${spId}`);
  must(await adj.getByLabel('Ajouter une tireuse').count() === 1, "l'adjoint ne peut pas modifier la combinaison");
  for (const email of ['comm.test@yfc.test']) {
    const p = await login(browser, email);
    for (const url of ['/tactique/cpa', `/tactique/cpa/${spId}`, '/impression/cpa']) {
      await p.goto(`${BASE}${url}`);
      must(/acces-refuse/.test(p.url()), `${email} accède à ${url}`);
    }
  }
  log('droits : adjoint modifie ; communication refusée (liste, fiche, carnet)');

  // 9. Mobile
  const mob = await login(browser, 'coach.test@yfc.test', { width: 390, height: 844 });
  for (const url of ['/tactique/cpa', `/tactique/cpa/${spId}`, `/entrainement/schemas/${diagramId}`, '/entrainement/schemas/nouveau']) {
    await mob.goto(`${BASE}${url}`);
    const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(over <= 1, `débordement horizontal ${over}px sur ${url}`);
  }
  await mob.goto(`${BASE}/tactique/cpa/${spId}`);
  await shot(mob, '06-mobile-cpa');
  log('mobile 390 px : 4 écrans sans débordement horizontal');

  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`\nRecette livraison 5 : ${n} étapes OK, aucune erreur JS ni serveur.`);
})().catch((e) => { console.error('✘', e.message, '\n', errors.join('\n')); process.exit(1); });
