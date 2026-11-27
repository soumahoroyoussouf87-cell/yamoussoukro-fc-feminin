/* eslint-disable @typescript-eslint/no-require-imports */
// Recette « Phase 3 · Livraison 3 » (Playwright) sur la pile Supabase LOCALE.
// Projet de jeu versionné, systèmes et animations, évaluations collectives, IPC/IPS/IPR, compacité, droits, mobile.
// Usage : node tests/e2e/recette-collective.cjs <dossier-captures>
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const shots = process.argv[2] || '/tmp/recette-collective';
fs.mkdirSync(shots, { recursive: true });
const PW = 'Recette-Phase2-2026';
let n = 0;
const log = (...a) => console.log(`✔ ${String(++n).padStart(2, '0')}`, ...a);
const errors = [];
const iso = (d) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const sql = (q) => execSync(`psql ${DB} -Atqc "${q}"`).toString().trim();

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

async function newEvaluation(page, title, date) {
  await page.goto(`${BASE}/performance/collective/nouvelle`);
  await page.fill('#evaluated_on', date);
  await page.fill('#title', title);
  await page.getByRole('button', { name: "Créer l'évaluation collective" }).click();
  await page.waitForURL(/\/performance\/collective\/[0-9a-f-]+\?nouvelle=1/);
  return page.url().match(/collective\/([0-9a-f-]+)/)[1];
}
const rate = (page, label, score) => page.getByRole('group', { name: `Note : ${label}` }).first().getByRole('button', { name: String(score), exact: true }).click();
const saved = (page) => page.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });

(async () => {
  // État propre (pile locale uniquement).
  sql("delete from public.collective_evaluations where title ilike '%recette%'");
  sql("delete from public.game_systems where name ilike '%recette%'");
  sql("delete from public.game_model_versions where status = 'brouillon'");
  const p1 = sql("select p.label from public.game_principles p join public.game_model_versions v on v.id = p.version_id where v.status = 'publie' order by p.sort_order limit 1");
  const p2 = sql("select p.label from public.game_principles p join public.game_model_versions v on v.id = p.version_id where v.status = 'publie' order by p.sort_order offset 1 limit 1");
  const browser = await chromium.launch();
  const coach = await login(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // 1. Projet de jeu publié, figé ; brouillon v+1
  await coach.goto(`${BASE}/projet-de-jeu`);
  const main = coach.locator('main');
  await main.getByText(/Version publiée : v\d/).waitFor();
  must(await main.getByLabel('Pondération du moment (%)').count() === 0, 'version publiée modifiable');
  await shot(coach, '01-projet-de-jeu');
  await coach.getByLabel(/Nouvelle version/).fill('Recette brouillon');
  await coach.getByRole('button', { name: 'Créer le brouillon' }).click();
  await coach.waitForURL(/\/projet-de-jeu\/versions\/[0-9a-f-]+/);
  const w = coach.getByLabel('Pondération du moment (%)');
  must(await w.count() === 5, 'pondérations du brouillon non modifiables');
  await w.last().fill('20');
  await w.last().blur();
  await coach.getByText('Total des pondérations : 110 % (100 % requis pour publier)').waitFor({ timeout: 10000 });
  await shot(coach, '02-brouillon');
  log('projet de jeu : version publiée figée ; brouillon créé et pondérations modifiables (total 110 signalé)');
  await coach.getByRole('button', { name: 'Supprimer le brouillon' }).click();
  await coach.getByRole('button', { name: 'Supprimer le brouillon' }).click();
  await coach.waitForURL(/\/projet-de-jeu$/);
  must(sql("select count(*) from public.game_model_versions where status = 'brouillon'") === '0', 'brouillon non supprimé');
  log('brouillon supprimé ; la version publiée est intacte');

  // 2. Système de référence + animation
  await coach.goto(`${BASE}/projet-de-jeu/systemes`);
  await coach.getByLabel('Nom (facultatif)').fill('4-3-3 recette');
  await coach.getByRole('button', { name: 'Créer le système' }).click();
  const sys = coach.locator('section[aria-label="4-3-3 recette"]');
  await sys.waitFor();
  const gk = sys.getByRole('group', { name: 'Placement 4-3-3 recette' }).getByRole('button').first();
  const before = await gk.getAttribute('aria-label');
  await gk.focus();
  await coach.keyboard.press('ArrowUp');
  await coach.keyboard.press('ArrowUp');
  must((await gk.getAttribute('aria-label')) !== before, 'déplacement clavier sans effet');
  await sys.getByRole('button', { name: 'Enregistrer' }).first().click();
  await sys.getByText('Enregistré.').waitFor();
  await sys.getByRole('button', { name: 'Système du club' }).click();
  await sys.getByText('Système du club').first().waitFor();
  await sys.getByPlaceholder('Ex. 3-2-5 en possession').fill('3-2-5 recette');
  await sys.getByRole('button', { name: "Ajouter l'animation" }).click();
  await sys.getByRole('heading', { name: 'Animations (1)' }).waitFor();
  await shot(coach, '03-systemes');
  log('systèmes : 4-3-3 créé, joueuse déplacée au clavier, système du club, animation en possession');

  // 3. Évaluation collective par l'adjoint
  const adj = await login(browser, 'adjoint.test@yfc.test');
  const e1 = await newEvaluation(adj, 'Collectif recette 1', iso(-12));
  await rate(adj, p1, 4);
  await rate(adj, p2, 3);
  await adj.getByRole('button', { name: `Observation pour ${p1}` }).click();
  await adj.getByPlaceholder(/Ce qui s'est passé/).first().fill('Relance courte réussie 6 fois sur 8');
  await adj.getByRole('tab', { name: /Secteurs/ }).click();
  await rate(adj, 'Coordination', 3);
  await adj.getByRole('tab', { name: /Relations et compacité/ }).click();
  await adj.getByLabel('Distance (m)').fill('13');
  await adj.getByRole('button', { name: 'Enregistrer la distance' }).click();
  await adj.getByText(/dans l'objectif 10-15 m/).waitFor();
  await rate(adj, 'Distances', 4);
  await saved(adj);
  await shot(adj, '04-saisie-collective');
  const sc = sql(`select count(*) from public.collective_scores where collective_evaluation_id = '${e1}' and score is not null`);
  must(sc === '4', `notes enregistrées : ${sc}`);
  must(sql(`select target_min||'-'||target_max from public.collective_measures where collective_evaluation_id = '${e1}'`) === '10.0-15.0', 'objectif non copié');
  log('adjoint : 2 principes, 1 critère sectoriel, 1 relation, distance 13 m dans l’objectif 10-15 m');
  must(await adj.getByRole('button', { name: 'Valider' }).count() === 0, 'bouton Valider visible pour l’adjoint');
  await adj.getByRole('button', { name: 'Soumettre à validation' }).click();
  await adj.getByText('Soumis', { exact: true }).first().waitFor();
  log('adjoint : soumission (validation réservée)');

  // 4. Validation, puis deux autres évaluations pour franchir le seuil
  await coach.goto(`${BASE}/performance/collective/${e1}`);
  await coach.getByRole('button', { name: 'Valider' }).click();
  await coach.getByText('Validé', { exact: true }).first().waitFor();
  await adj.goto(`${BASE}/performance/collective/${e1}`);
  must(await adj.getByRole('group', { name: `Note : ${p1}` }).first().getByRole('button', { name: '4', exact: true }).isDisabled(), 'évaluation validée modifiable par l’adjoint');
  log('entraîneur principal : validation ; évaluation verrouillée pour l’adjoint');

  await coach.goto(`${BASE}/performance/collective?periode=tout`);
  must(/Données insuffisantes/.test(await coach.locator('main').innerText()), 'IPC publié sous le seuil');
  for (const [i, s] of [[2, 4], [3, 5]]) {
    const id = await newEvaluation(coach, `Collectif recette ${i}`, iso(-12 + i * 4));
    await rate(coach, p1, s);
    await saved(coach);
    await coach.getByRole('button', { name: 'Valider' }).click();
    await coach.getByText('Validé', { exact: true }).first().waitFor();
    void id;
  }
  log('deux évaluations supplémentaires validées (seuil de 3 atteint)');

  // 5. Performance collective
  await coach.goto(`${BASE}/performance/collective?periode=tout`);
  const text = await coach.locator('main').innerText();
  must(/IPC · collectif\s*\d/i.test(text), 'IPC non publié');
  must(/IDC · progression collective\s*\+/i.test(text), 'IDC absent');
  must(/1\/1 mesure\(s\) dans la zone cible/.test(text), 'compacité absente');
  must(/Maîtrisé/.test(text), 'principe maîtrisé absent');
  await shot(coach, '05-performance-collective');
  log('performance collective : IPC publié, IDC positif, compacité 1/1, principes maîtrisés');

  // 6. Tableau de bord et Match Center
  await coach.goto(`${BASE}/tableau-de-bord`);
  const dash = await coach.locator('section[aria-labelledby=indices-title]').innerText();
  must(/Collectif \(IPC\)\s*\d/i.test(dash), `IPC absent du tableau de bord : ${dash.slice(0, 400)}`);
  const mid = sql("select id from public.matches where kickoff_at < now() order by kickoff_at desc limit 1");
  if (mid) {
    await coach.goto(`${BASE}/competition/rencontres/${mid}`);
    await coach.getByRole('link', { name: 'Évaluer le collectif' }).click();
    await coach.waitForURL(/collective\/nouvelle\?match=/);
    must(await coach.locator('#match_id').inputValue() === mid, 'match non présélectionné');
  }
  log('tableau de bord : tuile IPC alimentée ; Match Center → évaluation collective du match');

  // 7. Droits
  const comm = await login(browser, 'comm.test@yfc.test');
  await comm.goto(`${BASE}/performance/collective`);
  must(/acces-refuse/.test(comm.url()), 'communication accède au collectif');
  await adj.goto(`${BASE}/projet-de-jeu/systemes`);
  must(await adj.getByRole('button', { name: 'Créer le système' }).count() === 0, 'adjoint peut créer un système');
  log('droits : communication refusée ; projet de jeu et systèmes en lecture seule pour l’adjoint');

  // 8. Mobile
  const mob = await login(browser, 'coach.test@yfc.test', { width: 390, height: 844 });
  for (const url of [`/performance/collective/${e1}`, '/performance/collective?periode=tout', '/projet-de-jeu', '/projet-de-jeu/systemes', '/performance/collective/nouvelle']) {
    await mob.goto(`${BASE}${url}`);
    const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(over <= 1, `débordement horizontal ${over}px sur ${url}`);
  }
  await mob.goto(`${BASE}/performance/collective/${e1}`);
  await shot(mob, '06-mobile-evaluation');
  log('mobile 390 px : 5 écrans sans débordement horizontal');

  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`\nRecette collectif : ${n} étapes OK, aucune erreur JS ni serveur.`);
})().catch((e) => { console.error('✘', e.message, '\n', errors.join('\n')); process.exit(1); });
