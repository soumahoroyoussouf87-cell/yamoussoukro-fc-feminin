/* eslint-disable @typescript-eslint/no-require-imports */
// Recette « Phase 4 · Livraison 1 » (Playwright) sur la pile Supabase LOCALE : plans de développement.
// Usage : node tests/e2e/recette-pdi.cjs <dossier-captures>
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const shots = process.argv[2] || '/tmp/recette-pdi';
fs.mkdirSync(shots, { recursive: true });
const PW = 'Recette-Phase2-2026';
let n = 0;
const log = (...a) => console.log(`✔ ${String(++n).padStart(2, '0')}`, ...a);
const errors = [];
const sql = (q) => execSync(`psql ${DB} -Atqc "${q}"`).toString().trim();
const iso = (d) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

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
const saved = (page) => page.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });

(async () => {
  sql("delete from public.development_plans where title ilike '%recette%'");
  sql("delete from public.notifications where kind = 'developpement'");
  // Joueuse ayant le plus d'évaluations validées (point de départ réel en local).
  const [playerId, last] = sql("select ie.player_id || '|' || p.last_name from individual_evaluations ie join evaluation_sessions s on s.id = ie.evaluation_session_id join players p on p.id = ie.player_id where s.status in ('valide','publie') group by 1 order by count(*) desc limit 1").split('|');
  const adjId = sql("select id from auth.users where email = 'adjoint.test@yfc.test'");
  const adjStaff = sql(`select id from public.staff_members where profile_id = '${adjId}'`);
  must(adjStaff, "l'adjoint n'est relié à aucun membre du staff (lancer d'abord recette-l4)");
  const browser = await chromium.launch();
  const coach = await login(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // 1. Création depuis le profil 360°
  await coach.goto(`${BASE}/performance/individuelle/${playerId}`);
  await coach.getByRole('link', { name: 'Créer un plan de développement' }).click();
  await coach.waitForURL('**/developpement/nouveau**');
  must(await coach.getByLabel('Joueuse').inputValue() === playerId, 'joueuse non présélectionnée');
  await coach.getByLabel('Titre du plan').fill('Jeu long recette');
  await coach.getByLabel('Responsable du suivi').selectOption(adjStaff);
  await coach.getByLabel('Première réévaluation').fill(iso(5));
  await coach.getByRole('button', { name: 'Créer le plan' }).click();
  await coach.waitForURL(/\/developpement\/[0-9a-f-]{36}$/);
  const planId = coach.url().split('/').pop();
  must(sql(`select count(*) from public.notifications where kind = 'developpement' and user_id = '${adjId}'`) === '1', 'responsable non notifié');
  log(`plan individuel créé depuis le profil 360° (${last}) ; responsable notifié`);

  // 2. Point de départ et constats
  await coach.getByRole('region', { name: 'Point de départ' }).waitFor();
  must(await coach.getByRole('region', { name: 'Point de départ' }).getByText(/Évaluations validées avant le/).count() === 1, 'point de départ absent');
  await coach.getByLabel('Constats (faits observés, mesures)').fill('2 passes longues réussies sur 5 lors des 3 derniers matchs.');
  await coach.getByLabel('Analyse du staff (interprétation)').fill('Orientation du corps fermée avant la réception.');
  await saved(coach);
  log('point de départ (évaluations validées) et constats / analyse séparés');

  // 3. Objectifs : suggestion issue des évaluations puis objectif libre
  const sugg = coach.getByRole('button', { name: /\/100 \(\d+ obs\.\)/ });
  const hadSuggestion = (await sugg.count()) > 0;
  if (hadSuggestion) {
    await sugg.first().click();
    await coach.getByRole('article', { name: 'Objectif 1' }).waitFor();
  }
  await coach.getByLabel('Nouvel objectif').fill('Réussir 4 passes longues sur 5 en match');
  await coach.getByRole('button', { name: "Ajouter l'objectif" }).click();
  const k = hadSuggestion ? 2 : 1;
  const card = coach.getByRole('article', { name: `Objectif ${k}` });
  await card.waitFor();
  await card.getByLabel('Départ').fill('2');
  await card.getByLabel('Cible').fill('4');
  await card.getByLabel('Unité').fill('/5');
  await card.getByLabel('Dimension').selectOption('technique');
  await saved(coach);
  // Exercice correctif de la bibliothèque + consigne libre
  await card.getByLabel('Exercice de la bibliothèque').selectOption({ index: 1 });
  await card.getByLabel('Fréquence', { exact: true }).fill('2 fois par semaine');
  await card.getByRole('button', { name: 'Prescrire' }).click();
  await card.getByText('2 fois par semaine').or(card.locator('input[value="2 fois par semaine"]')).first().waitFor();
  await card.getByLabel('Ou consigne libre').fill('Gainage 3 x 30 s avant la séance');
  await card.getByRole('button', { name: 'Prescrire' }).click();
  await card.getByText('Gainage 3 x 30 s avant la séance').waitFor();
  const objCount = sql(`select count(*) from public.development_objectives where plan_id = '${planId}'`);
  must(objCount === String(k), `objectifs attendus ${k}, trouvés ${objCount}`);
  must(sql(`select count(*) from public.development_actions a join public.development_objectives o on o.id = a.objective_id where o.plan_id = '${planId}'`) === '2', 'exercices non enregistrés');
  if (hadSuggestion) must(await coach.getByText(/Mesure actuelle/).count() >= 1, 'mesure actuelle absente pour l’objectif relié à un critère');
  await shot(coach, '01-plan-objectifs');
  log(`${k} objectif(s)${hadSuggestion ? ' dont 1 repris des axes de travail' : ''}, 2 exercices correctifs (bibliothèque + consigne libre)`);

  // 4. Réévaluation
  await coach.getByRole('button', { name: 'Nouvelle réévaluation' }).click();
  await coach.getByLabel(`Résultat ${k}`).selectOption('partiel');
  await coach.getByLabel(`Valeur mesurée ${k}`).fill('3');
  await coach.getByLabel('Prochaine réévaluation', { exact: true }).last().fill(iso(30));
  await coach.getByLabel('Faits constatés').fill('3 passes longues réussies sur 5 en moyenne.');
  await coach.getByRole('button', { name: 'Enregistrer la réévaluation' }).click();
  await coach.getByText('Réévaluation enregistrée.').waitFor();
  must(sql(`select next_review_on from public.development_plans where id = '${planId}'`) === iso(30), 'prochaine réévaluation non reportée');
  await coach.getByRole('article', { name: `Objectif ${k}` }).getByText('Partiellement atteint').first().waitFor({ timeout: 10000 });
  await shot(coach, '02-reevaluation');
  log('réévaluation : résultat par objectif, prochaine date reportée sur le plan');

  // 5. Vues transversales
  await coach.getByRole('link', { name: 'Objectifs', exact: true }).first().click();
  await coach.waitForURL('**/developpement/objectifs');
  must(await coach.getByText('Réussir 4 passes longues sur 5 en match').count() === 1, 'objectif absent de la vue Objectifs');
  await coach.goto(`${BASE}/developpement/exercices`);
  must(await coach.getByText('Gainage 3 x 30 s avant la séance').count() >= 1, 'consigne absente de la vue Exercices');
  await shot(coach, '03-exercices-correctifs');
  await coach.goto(`${BASE}/developpement/reevaluations`);
  must(await coach.getByRole('region', { name: 'Réalisées' }).getByText('Jeu long recette').count() === 1, 'réévaluation absente');
  log('vues Objectifs, Exercices correctifs (regroupés) et Réévaluations');

  // 6. Plans sectoriel et collectif, clôture
  await coach.goto(`${BASE}/developpement/nouveau?portee=sectoriel`);
  await coach.getByLabel('Secteur').selectOption('defense');
  await coach.getByLabel('Titre du plan').fill('Alignement défensif recette');
  await coach.getByRole('button', { name: 'Créer le plan' }).click();
  await coach.waitForURL(/\/developpement\/[0-9a-f-]{36}$/);
  const sectorPlan = coach.url().split('/').pop();
  must(await coach.getByText(/Secteur Défense/).count() >= 1, 'secteur non affiché');
  await coach.getByLabel('Nouvel objectif').fill('Ligne à 4 alignée à la perte');
  await coach.getByRole('button', { name: "Ajouter l'objectif" }).click();
  await coach.getByRole('article', { name: 'Objectif 1' }).waitFor();
  await coach.getByRole('button', { name: 'Nouvelle réévaluation' }).click();
  await coach.getByLabel('Décision').selectOption('cloturer');
  await coach.getByLabel('Résultat 1').selectOption('atteint');
  await coach.getByRole('button', { name: 'Enregistrer la réévaluation' }).click();
  await coach.waitForFunction(() => document.body.innerText.includes('Terminé'));
  must(sql(`select status from public.development_plans where id = '${sectorPlan}'`) === 'termine', 'plan non clôturé');
  await coach.goto(`${BASE}/developpement/nouveau?portee=collectif`);
  await coach.getByLabel('Titre du plan').fill('Pressing collectif recette');
  await coach.getByRole('button', { name: 'Créer le plan' }).click();
  await coach.waitForURL(/\/developpement\/[0-9a-f-]{36}$/);
  log('plan sectoriel créé puis clôturé par réévaluation ; plan collectif créé');

  // 7. Liste, tableau de bord, impression
  await coach.goto(`${BASE}/developpement?portee=individuel`);
  must(await coach.getByText('Jeu long recette').count() === 1, 'plan absent de la liste');
  await shot(coach, '04-liste-plans');
  await coach.goto(`${BASE}/developpement?statut=termine`);
  must(await coach.getByText('Alignement défensif recette').count() === 1, 'plan terminé absent du filtre');
  sql(`update public.development_plans set next_review_on = current_date + 3 where id = '${planId}'`);
  await coach.goto(`${BASE}/tableau-de-bord`);
  must(await coach.getByText('Réévaluations à faire').count() === 1 && await coach.getByRole('link', { name: /Jeu long recette/ }).count() === 1, 'carte du tableau de bord absente');
  await coach.goto(`${BASE}/impression/pdi/${planId}`);
  must(await coach.getByText('Réussir 4 passes longues sur 5 en match').count() === 1 && await coach.getByText('Signature de la joueuse').count() === 1, 'impression incomplète');
  await shot(coach, '05-impression-pdi');
  await coach.goto(`${BASE}/performance/individuelle/${playerId}`);
  must(await coach.getByRole('link', { name: 'Plan de développement' }).count() === 1, 'lien vers le plan absent du profil');
  log('liste filtrée, carte « Réévaluations à faire », PDF du plan, lien depuis le profil 360°');

  // 8. Droits
  const adj = await login(browser, 'adjoint.test@yfc.test');
  await adj.goto(`${BASE}/developpement/${planId}`);
  must(await adj.getByLabel('Nouvel objectif').count() === 1, "l'adjoint ne peut pas modifier le plan");
  const comm = await login(browser, 'comm.test@yfc.test');
  for (const url of ['/developpement', `/developpement/${planId}`, '/developpement/objectifs', `/impression/pdi/${planId}`]) {
    await comm.goto(`${BASE}${url}`);
    must(/acces-refuse/.test(comm.url()), `communication accède à ${url}`);
  }
  log('droits : adjoint modifie ; communication refusée (liste, plan, objectifs, impression)');

  // 9. Mobile
  const mob = await login(browser, 'coach.test@yfc.test', { width: 390, height: 844 });
  for (const url of ['/developpement', `/developpement/${planId}`, '/developpement/objectifs', '/developpement/exercices', '/developpement/reevaluations', '/developpement/nouveau']) {
    await mob.goto(`${BASE}${url}`);
    const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(over <= 1, `débordement horizontal ${over}px sur ${url}`);
  }
  await mob.goto(`${BASE}/developpement/${planId}`);
  await shot(mob, '06-mobile-plan');
  log('mobile 390 px : 6 écrans sans débordement horizontal');

  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`\nRecette Phase 4 · livraison 1 : ${n} étapes OK, aucune erreur JS ni serveur.`);
})().catch((e) => { console.error('✘', e.message, '\n', errors.join('\n')); process.exit(1); });
