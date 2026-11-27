/* eslint-disable @typescript-eslint/no-require-imports */
// Recette « Phase 3 · Livraison 2 » (Playwright) sur la pile Supabase LOCALE.
// Protocoles versionnés, séances de tests, saisie, validation, source Tests, IDI, droits, mobile.
// Usage : node tests/e2e/recette-tests.cjs <dossier-captures>
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const shots = process.argv[2] || '/tmp/recette-tests';
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

async function newSession(page, title, date) {
  await page.goto(`${BASE}/performance/tests/nouvelle`);
  await page.getByLabel(/Passe courte sur cible/).check();
  await page.getByLabel(/^Slalom/).check();
  await page.fill('#tested_on', date);
  await page.fill('#title', title);
  await page.fill('#conditions', 'Synthétique, temps sec, ballons taille 5');
  await page.getByRole('button', { name: 'Créer la séance de tests' }).click();
  await page.waitForURL(/\/performance\/tests\/[0-9a-f-]+\?nouvelle=1/);
  return page.url().match(/tests\/([0-9a-f-]+)/)[1];
}

async function pickPlayers(page, count) {
  await page.getByRole('button', { name: "Afficher tout l'effectif" }).click().catch(() => {});
  const boxes = page.locator('section[aria-labelledby=setup-title] fieldset').nth(1).locator('input[type=checkbox]');
  for (let i = 0; i < count; i++) await boxes.nth(i).check();
  await page.getByRole('button', { name: 'Mettre à jour la grille' }).click();
  await page.locator('section[aria-labelledby=sheet-title] tbody tr').nth(count - 1).waitFor();
}

const cell = (page, row, label) => page.locator('section[aria-labelledby=sheet-title] tbody tr').nth(row).getByLabel(label);

(async () => {
  // État propre : séances de tests des recettes précédentes supprimées, barème du slalom effacé (pile locale uniquement).
  sql("delete from public.technical_test_sessions where title ilike '%recette%'");
  sql("update public.technical_test_protocols set ref_best = null, ref_limit = null where code = 'slalom'");
  const browser = await chromium.launch();
  const coach = await login(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // 1. Protocoles
  await coach.goto(`${BASE}/performance/tests/protocoles`);
  must(await coach.locator('main li h3').count() === 12, 'les 12 protocoles ne sont pas listés');
  const slalom = coach.locator('main li').filter({ has: coach.getByRole('heading', { name: /^Slalom/ }) });
  must(/Barème : à définir/.test(await slalom.innerText()), 'barème du slalom non signalé');
  const vBefore = Number(sql("select version_no from public.technical_test_protocols where code = 'slalom'"));
  await slalom.getByRole('button', { name: 'Modifier' }).click();
  await slalom.getByLabel('Temps de référence (= 100)').fill('8');
  await slalom.getByLabel('Temps limite (= 0)').fill('12');
  await slalom.getByText(/créent la version \d+ du protocole/).waitFor();
  await shot(coach, '01-protocole-edition');
  await slalom.getByRole('button', { name: 'Enregistrer' }).click();
  await slalom.getByText(/Barème : 8 s = 100, 12 s = 0/).waitFor();
  must(Number(sql("select version_no from public.technical_test_protocols where code = 'slalom'")) === vBefore + 1, 'nouvelle version non créée');
  log(`protocoles : 12 listés ; barème du slalom défini → version ${vBefore + 1}`);

  // 2. Séance 1 saisie par l'adjoint
  const adj = await login(browser, 'adjoint.test@yfc.test');
  const s1 = await newSession(adj, 'Tests recette 1', iso(-20));
  await pickPlayers(adj, 2);
  log('adjoint : séance de tests créée, 2 protocoles, 2 joueuses');

  await cell(adj, 0, /réussites/).fill('6');
  await cell(adj, 1, /réussites/).fill('8');
  await cell(adj, 1, /erreurs/).fill('1');
  await adj.waitForFunction(() => document.querySelectorAll('section[aria-labelledby=sheet-title] tbody tr td:nth-child(5)')[0]?.textContent === '60');
  must(await cell(adj, 0, /tentatives/).inputValue() === '10', 'tentatives prévues non reprises');
  await adj.getByRole('tab', { name: /Slalom/ }).click();
  await cell(adj, 0, /temps en secondes/).fill('10');
  await adj.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });
  await shot(adj, '02-saisie-resultats');
  const idx = sql(`select string_agg(index_value::text, ',' order by index_value) from public.technical_test_results where test_session_id = '${s1}'`);
  must(idx === '50.0,60.0,80.0', `indices enregistrés inattendus : ${idx}`);
  log('saisie : 6/10 → 60, 8/10 → 80, slalom 10 s → 50 (enregistrement automatique)');

  must(await adj.getByRole('button', { name: 'Valider' }).count() === 0, 'bouton Valider visible pour l’adjoint');
  await adj.getByRole('button', { name: 'Soumettre à validation' }).click();
  await adj.getByText('Soumis', { exact: true }).first().waitFor();
  log('adjoint : soumission (validation réservée)');

  // 3. Validation par l'entraîneur principal
  await coach.goto(`${BASE}/performance/tests/${s1}`);
  await coach.getByRole('button', { name: 'Valider' }).click();
  await coach.getByText('Validé', { exact: true }).first().waitFor();
  await adj.goto(`${BASE}/performance/tests/${s1}`);
  must(await adj.locator('section[aria-labelledby=sheet-title] input').first().isDisabled(), 'résultats validés encore modifiables par l’adjoint');
  log('entraîneur principal : validation ; résultats verrouillés pour l’adjoint');

  // 4. Séance 2 : même protocole, progression
  const s2 = await newSession(coach, 'Tests recette 2', iso(-2));
  await pickPlayers(coach, 1);
  await cell(coach, 0, /réussites/).fill('8');
  await coach.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });
  await coach.getByRole('button', { name: 'Valider' }).click();
  await coach.getByText('Validé', { exact: true }).first().waitFor();
  log('séance 2 validée : même joueuse 8/10');

  // 5. Profil : tests, source Tests, IDI
  const pid = sql(`select player_ids[1] from public.technical_test_sessions where id = '${s2}'`);
  await coach.goto(`${BASE}/performance/individuelle/${pid}?periode=tout`);
  const main = coach.locator('main');
  await main.getByText('Développement (IDI)').waitFor();
  const text = await main.innerText();
  must(/Passe courte sur cible[\s\S]*\+20 pts/.test(text), 'évolution +20 pts absente');
  must(/IDI · développement[\s\S]{0,40}\+20 pts/i.test(text), 'tuile IDI absente');
  must(/\+33,3 %/.test(text), 'progression relative absente');
  must(/Tests techniques \d/.test(text) || /Tests techniques/.test(text), 'source Tests absente');
  await shot(coach, '03-profil-tests-idi');
  log('profil : tableau des tests, évolution +20 pts (+33,3 %), IDI');

  // 6. Tableau de bord
  await coach.goto(`${BASE}/tableau-de-bord`);
  const dash = await coach.locator('section[aria-labelledby=indices-title]').innerText();
  must(/Progression générale \(IDI\)\s*\+/i.test(dash), 'IDI absent du tableau de bord');
  log('tableau de bord : progression générale (IDI) affichée');

  // 7. Droits
  const comm = await login(browser, 'comm.test@yfc.test');
  await comm.goto(`${BASE}/performance/tests`);
  must(/acces-refuse/.test(comm.url()), 'communication accède aux tests');
  await adj.goto(`${BASE}/performance/tests/protocoles`);
  must(await adj.getByRole('button', { name: 'Modifier' }).count() === 0, 'adjoint peut modifier les protocoles');
  log('droits : communication refusée ; protocoles en lecture seule pour l’adjoint');

  // 8. Mobile
  const mob = await login(browser, 'coach.test@yfc.test', { width: 390, height: 844 });
  for (const url of [`/performance/tests/${s1}`, '/performance/tests', '/performance/tests/protocoles', `/performance/individuelle/${pid}?periode=tout`]) {
    await mob.goto(`${BASE}${url}`);
    const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(over <= 1, `débordement horizontal ${over}px sur ${url}`);
  }
  await mob.goto(`${BASE}/performance/tests/${s1}`);
  await shot(mob, '04-mobile-seance');
  log('mobile 390 px : séance, liste, protocoles, profil sans débordement horizontal');

  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`\nRecette tests techniques : ${n} étapes OK, aucune erreur JS ni serveur.`);
})().catch((e) => { console.error('✘', e.message, '\n', errors.join('\n')); process.exit(1); });
