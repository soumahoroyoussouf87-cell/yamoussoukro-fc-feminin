/* eslint-disable @typescript-eslint/no-require-imports */
// Recette « Phase 3 · Livraison 1 » (Playwright) sur la pile Supabase LOCALE, après recette-phase2.cjs.
// Référentiels versionnés, évaluations 1-5 / N/E, validation, indices, profil 360°, droits.
// Usage : node tests/e2e/recette-performance.cjs <dossier-captures>
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const shots = process.argv[2] || '/tmp/recette-performance';
fs.mkdirSync(shots, { recursive: true });
const PW = 'Recette-Phase2-2026';
let n = 0;
const log = (...a) => console.log(`✔ ${String(++n).padStart(2, '0')}`, ...a);
const errors = [];
const iso = (d) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const TAG = `R${Date.now() % 100000}`;

async function login(browser, email, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport });
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

async function createEvaluation(page, title, date, context = 'match') {
  await page.goto(`${BASE}/performance/evaluations/nouvelle`);
  if (context === 'entrainement') await page.getByText('Entraînement (30 %)').click();
  await page.fill('#evaluated_on', date);
  await page.fill('#title', title);
  await page.getByRole('button', { name: "Créer l'évaluation" }).click();
  await page.waitForURL(/\/performance\/evaluations\/[0-9a-f-]+\?nouvelle=1/);
  return page.url().match(/evaluations\/([0-9a-f-]+)/)[1];
}

async function addFirstPlayers(page, count) {
  await page.getByRole('button', { name: "Afficher tout l'effectif" }).click().catch(() => {});
  const boxes = page.locator('section[aria-labelledby=add-players] input[type=checkbox]');
  for (let i = 0; i < count; i++) await boxes.nth(i).check();
  await page.getByRole('button', { name: /^Ajouter \d+ joueuse/ }).click();
  await page.getByRole('heading', { name: new RegExp(`Joueuses évaluées \\(${count}\\)`) }).waitFor();
}

async function scoreAll(page, value) {
  // Une note par critère technique et tactique, N/E pour le premier critère athlétique.
  for (const dim of ['technique', 'tactique', 'mentale']) {
    const groups = page.locator(`#dim-${dim} [role=group]`);
    const k = await groups.count();
    for (let i = 0; i < k; i++) await groups.nth(i).getByRole('button', { name: String(value), exact: true }).click();
  }
  await page.locator('#dim-athletique [role=group]').first().getByRole('button', { name: 'N/E' }).click();
  await page.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });
}

(async () => {
  // Repart d'un état propre : évaluations des recettes précédentes supprimées (pile locale uniquement).
  require('child_process').execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -qc "delete from public.evaluation_sessions where title ilike '%recette%'"`);
  const browser = await chromium.launch();
  const coach = await login(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // 1. Référentiel publié
  await coach.goto(`${BASE}/performance/referentiels`);
  await coach.getByRole('heading', { name: /Version publiée · v\d/ }).waitFor();
  const gk = await coach.locator('tr', { has: coach.getByRole('rowheader', { name: 'Gardienne' }) }).first().innerText();
  must(/30\s+25\s+15\s+20\s+5\s+5\s+100/.test(gk.replace(/\n/g, ' ')), `pondérations GB inattendues : ${gk}`);
  must(await coach.getByRole('rowheader', { name: 'Prise de balle' }).count() === 1, 'référentiel technique GB absent');
  await shot(coach, '01-referentiels');
  log('référentiel publié : pondérations du cahier des charges (GB 30/25/15/20/5/5) et référentiels techniques par poste');

  // 2. Nouvelle version : contrôle des totaux, publication, version précédente archivée
  const draftLink = coach.getByRole('link', { name: /Reprendre le brouillon/ });
  if (await draftLink.count()) await draftLink.click();
  else {
    await coach.getByPlaceholder(/Version 2/).fill(`Version recette ${TAG}`);
    await coach.getByRole('button', { name: 'Créer le brouillon' }).click();
  }
  await coach.waitForURL(/\/performance\/referentiels\/[0-9a-f-]+$/);
  await coach.getByText('Brouillon.', { exact: false }).first().waitFor();
  const cell = coach.getByLabel('Défenseure centrale — Tactique');
  await cell.fill('34');
  await cell.blur();
  await coach.getByText('99 ≠ 100').waitFor();
  await coach.getByRole('button', { name: 'Publier cette version' }).click();
  await coach.getByText(/DC : total 99/).waitFor();
  log('publication refusée tant que les pondérations d’un poste ne font pas 100 %');
  await cell.fill('35');
  await cell.blur();
  await coach.waitForTimeout(800);
  await coach.getByRole('button', { name: 'Publier cette version' }).click();
  await coach.getByText('Version publiée.').waitFor();
  await coach.goto(`${BASE}/performance/referentiels`);
  must(await coach.getByText('Archivé').count() >= 1, 'version précédente non archivée');
  await shot(coach, '02-versions');
  log('nouvelle version publiée, l’ancienne archivée (figée)');

  // 3. Évaluation de match : création, ajout de joueuses, notation
  const e1 = await createEvaluation(coach, `Match recette ${TAG}`, iso(-14));
  await addFirstPlayers(coach, 3);
  log('évaluation créée en brouillon, 3 joueuses ajoutées avec leur poste');
  await coach.getByRole('link', { name: 'Évaluer' }).first().click();
  await coach.waitForURL(/joueuses\/[0-9a-f-]+$/);
  await scoreAll(coach, 4);
  await coach.locator('#dim-technique li').first().getByRole('button', { name: /Observation pour/ }).click();
  await coach.getByPlaceholder(/Ce qui s'est passé/).fill('12e minute : contrôle orienté vers l’intérieur sous pression, passe vers la sentinelle.');
  await coach.getByPlaceholder(/Votre lecture/).fill('Bonne prise d’information avant réception.');
  await coach.getByText(/Enregistré à/).first().waitFor();
  const synth = await coach.locator('main aside').innerText();
  must(/Indice de cette évaluation\s+80/i.test(synth), `synthèse inattendue : ${synth}`);
  await shot(coach, '03-notation');
  log('notation 1-5 avec N/E, fait observé et interprétation séparés, synthèse 80 (N/E non pénalisant)');
  await coach.reload();
  must(await coach.locator('#dim-technique button[aria-pressed=true]').count() > 3, 'notes non conservées après rechargement');
  must(await coach.getByText('12e minute').count() === 1, 'fait observé non conservé');
  log('notes et observations conservées après rechargement');

  // 4. Seuil : 1 évaluation validée → données insuffisantes
  await coach.goto(`${BASE}/performance/evaluations/${e1}`);
  await coach.getByRole('button', { name: 'Valider' }).click();
  await coach.getByText('Validé', { exact: true }).first().waitFor();
  const playerHref = await coach.locator('table a[href*="/joueuses/"]').first().getAttribute('href');
  const playerId = playerHref.split('/').pop();
  await coach.goto(`${BASE}/performance/individuelle?periode=tout`);
  must(/Données insuffisantes \(1\/3\)/.test(await coach.locator('tr', { has: coach.locator(`a[href*="${playerId}"]`) }).innerText()), 'seuil de publication non appliqué');
  log('après une évaluation validée : « Données insuffisantes (1/3) », pas d’IPI publié');

  // 5. Deux autres évaluations (entraînement + match) → IPI publié
  for (const [i, ctxName, v] of [[1, 'entrainement', 3], [2, 'match', 5]]) {
    const id = await createEvaluation(coach, `Évaluation ${i + 1} recette ${TAG}`, iso(-14 + i * 4), ctxName);
    await coach.getByRole('button', { name: "Afficher tout l'effectif" }).click().catch(() => {});
    await coach.locator(`section[aria-labelledby=add-players] li`, { has: coach.locator(`#pick-${playerId}`) }).locator('input[type=checkbox]').check();
    await coach.getByRole('button', { name: /^Ajouter 1 joueuse/ }).click();
    await coach.getByRole('heading', { name: /Joueuses évaluées \(1\)/ }).waitFor();
    await coach.getByRole('link', { name: 'Évaluer' }).first().click();
    await coach.waitForURL(/joueuses\/[0-9a-f-]+$/);
    await scoreAll(coach, v);
    await coach.waitForTimeout(800);
    await coach.goto(`${BASE}/performance/evaluations/${id}`);
    await coach.getByRole('button', { name: 'Valider' }).click();
    await coach.getByText('Validé', { exact: true }).first().waitFor({ timeout: 10000 }).catch(async () => {
      await shot(coach, 'echec-validation');
      throw new Error(`validation impossible : ${(await coach.locator('main').innerText()).slice(0, 600)}`);
    });
  }
  await coach.goto(`${BASE}/performance/individuelle/${playerId}?periode=tout`);
  const kpis = await coach.locator('main').innerText();
  must(/IPI\s+\d/i.test(kpis) && /Évaluations validées\s+3/i.test(kpis), `profil inattendu : ${kpis.slice(0, 400)}`);
  must(await coach.locator('svg[aria-label^="Radar"]').count() === 1 && await coach.locator('svg[aria-label^="Progression"]').count() === 1, 'radar ou courbe absents');
  await shot(coach, '04-profil-360');
  log('3 évaluations validées : IPI publié, radar 6 dimensions, courbe de progression, historique');

  await coach.goto(`${BASE}/tableau-de-bord`);
  must(await coach.getByText(/Joueuse en focus/).count() === 1, 'widget joueuse en focus absent');
  await shot(coach, '05-tableau-de-bord');
  log('tableau de bord : indices de l’effectif et joueuse en focus alimentés par les évaluations validées');

  // 6. Adjoint : saisit mais ne valide pas ; évaluation validée en lecture seule
  const adj = await login(browser, 'adjoint.test@yfc.test');
  await adj.goto(`${BASE}/performance/evaluations/${e1}/joueuses/${playerId}`);
  must(await adj.locator('#dim-technique [role=group] button').first().isDisabled(), 'évaluation validée modifiable par l’adjoint');
  const e4 = await createEvaluation(adj, `Adjoint recette ${TAG}`, iso(-1));
  must(await adj.getByRole('button', { name: 'Valider' }).count() === 0, 'bouton Valider visible pour l’adjoint');
  must(await adj.getByRole('button', { name: 'Soumettre à validation' }).count() === 1, 'soumission indisponible');
  await adj.getByRole('button', { name: 'Soumettre à validation' }).click();
  await adj.getByText(/Aucune note saisie/).waitFor();
  log('adjoint : évaluation validée en lecture seule, pas de validation, soumission refusée sans note');
  await adj.goto(`${BASE}/performance/referentiels`);
  must(await adj.getByRole('button', { name: 'Créer le brouillon' }).count() === 0, 'adjoint peut créer une version');
  log('adjoint : référentiels en lecture seule (gestion réservée)');
  void e4;

  // 7. Rôle sans accès
  const comm = await login(browser, 'comm.test@yfc.test');
  await comm.goto(`${BASE}/performance/individuelle`);
  must(/acces-refuse/.test(comm.url()), 'communication accède aux évaluations');
  log('responsable communication : accès refusé aux évaluations');

  // 8. Mobile
  const mob = await login(browser, 'coach.test@yfc.test', { width: 390, height: 844 });
  for (const url of [`/performance/evaluations/${e1}/joueuses/${playerId}`, `/performance/individuelle/${playerId}?periode=tout`, '/performance/individuelle', '/performance/referentiels']) {
    await mob.goto(`${BASE}${url}`);
    const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(over <= 1, `débordement horizontal ${over}px sur ${url}`);
  }
  await shot(mob, '06-mobile-profil');
  log('mobile 390 px : saisie, profil, tableaux sans débordement horizontal');

  await browser.close();
  if (errors.length) {
    console.log('\nErreurs relevées :');
    for (const e of errors) console.log(' -', e);
    process.exit(1);
  }
  console.log(`\nRecette performance : ${n} étapes réussies, aucune erreur JS ni serveur.`);
})().catch((e) => { console.error('ÉCHEC', e); for (const x of errors) console.log(' -', x); process.exit(1); });
