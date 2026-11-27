/* eslint-disable @typescript-eslint/no-require-imports */
// Recette « Phase 3 · Livraison 4 » (Playwright) sur la pile Supabase LOCALE.
// Analyse des adversaires, rapport d avant-match, rapports PDF, bilan, tâches du staff, droits, mobile.
// Usage : node tests/e2e/recette-l4.cjs <dossier-captures>
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const shots = process.argv[2] || '/tmp/recette-l4';
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

(async () => {
  // État propre (pile locale uniquement) : fiches et tâches de recette supprimées ; l'adjoint relié à une fiche du staff.
  sql("delete from public.opponent_scouting where source_detail ilike '%recette%'");
  sql("delete from public.staff_tasks where title ilike '%recette%'");
  const adjId = sql("select id from auth.users where email = 'adjoint.test@yfc.test'");
  sql("update public.staff_members set profile_id = null where profile_id = '" + adjId + "'");
  const awa = sql("select id from public.staff_members where last_name = 'COACH' limit 1");
  sql(`update public.staff_members set profile_id = '${adjId}' where id = '${awa}'`);
  if (sql("select count(*) from public.matches where kickoff_at > now() and status = 'programme'") === '0') {
    sql(`insert into public.matches (club_id, team_id, season_id, opponent_id, kickoff_at, matchday, venue) select club_id, team_id, season_id, opponent_id, now() + interval '5 days', 'Recette', 'Stade recette' from public.matches order by kickoff_at limit 1`);
  }
  const next = sql("select m.id || '|' || m.opponent_id || '|' || o.name from public.matches m join public.opponents o on o.id = m.opponent_id where m.kickoff_at > now() and m.status = 'programme' order by m.kickoff_at limit 1").split('|');
  const [matchId, oppId, oppName] = next;
  must(matchId, 'aucun match à venir en local');
  const browser = await chromium.launch();
  const coach = await login(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // 1. Analyse des adversaires
  await coach.goto(`${BASE}/tactique/adversaires`);
  const first = coach.locator('main tbody tr').first();
  must((await first.innerText()).includes(oppName), `le prochain adversaire (${oppName}) n'est pas en tête`);
  await first.getByRole('link').click();
  await coach.waitForURL(`**/tactique/adversaires/${oppId}`);
  await coach.getByRole('button', { name: "Nouvelle fiche d'observation" }).click();
  await coach.getByLabel('Source').selectOption('video');
  await coach.getByRole('button', { name: 'Créer la fiche' }).click();
  await coach.waitForURL(/\?fiche=/);
  const card = coach.locator('article').first();
  await card.getByLabel('Système habituel').fill('4-4-2');
  await card.getByLabel('Précision sur la source').fill('Vidéo recette, match aller');
  await card.getByLabel('En possession').fill('Relance longue vers la n°9 dès la pression.');
  await card.getByLabel('Coups de pied arrêtés').fill('Corners rentrants, tireuse n°7.');
  await card.getByLabel('Faiblesses').fill('Espace dans le dos des latérales.');
  await card.getByLabel('Plan de jeu proposé').fill('Presser la relance courte, attaquer la profondeur côté droit.');
  await coach.getByText(/Enregistré à/).first().waitFor({ timeout: 15000 });
  must(sql(`select usual_system || '|' || coalesce(game_plan,'') from public.opponent_scouting where opponent_id = '${oppId}' and source_detail ilike '%recette%'`).startsWith('4-4-2|Presser'), 'fiche non enregistrée');
  await shot(coach, '01-fiche-adversaire');
  log(`adversaires : ${oppName} en tête (prochain match) ; fiche d'observation créée, faits et lecture du staff enregistrés automatiquement`);

  // 2. Rapport d'avant-match
  await coach.goto(`${BASE}/impression/avant-match/${matchId}`);
  const pre = await coach.locator('#document').innerText();
  must(/RAPPORT D'AVANT-MATCH/i.test(pre) && pre.includes('4-4-2') && pre.includes('Presser la relance courte'), 'rapport d’avant-match incomplet');
  must(/Lecture du staff/i.test(pre), 'séparation faits / interprétation absente');
  await shot(coach, '02-avant-match');
  log('rapport d’avant-match : confrontations, forme, dernière observation (faits puis lecture du staff), plan de jeu');

  // 3. Rapports de performance
  await coach.goto(`${BASE}/rapports/performance?periode=tout`);
  await coach.getByRole('heading', { name: 'Rapports individuels' }).waitFor();
  const pl = coach.locator('#individuels a').first();
  const href = await pl.getAttribute('href');
  for (const url of [href, '/impression/rapport-collectif?periode=tout', '/impression/bilan?periode=tout']) {
    await coach.goto(`${BASE}${url}`);
    await coach.locator('#document').waitFor();
    must((await coach.locator('#document img[alt*="Logo officiel"]').count()) === 1, `logo absent sur ${url}`);
  }
  const bilan = await coach.locator('#document').innerText();
  must(/Matchs joués/i.test(bilan) && /IPC/i.test(bilan), `bilan incomplet : ${bilan.slice(0, 300)}`);
  await shot(coach, '03-bilan');
  await coach.goto(`${BASE}/impression/rapport-collectif?periode=tout`);
  must(/Secteurs/i.test(await coach.locator('#document').innerText()), 'rapport collectif sans secteurs');
  await shot(coach, '04-rapport-collectif');
  log('rapports : individuel, collectif (secteurs et relations) et bilan périodique, avec le logo officiel');

  // 4. Tâches du staff
  await coach.goto(`${BASE}/taches?vue=toutes`);
  await coach.getByRole('button', { name: 'Nouvelle tâche' }).click();
  await coach.locator('#t-title').fill('Monter la vidéo recette');
  await coach.locator('#t-assignee').selectOption(awa);
  await coach.locator('#t-due').fill(iso(-1));
  await coach.locator('#t-prio').selectOption('haute');
  await coach.getByRole('button', { name: 'Créer la tâche' }).click();
  await coach.getByText('Monter la vidéo recette').waitFor();
  must(await coach.getByText(/En retard/).count() >= 1, 'retard non signalé');
  log('tâche créée par l’entraîneur principal, confiée à l’adjoint, en retard signalé');

  const adj = await login(browser, 'adjoint.test@yfc.test');
  must(/Monter la vidéo recette/.test(await adj.locator('main').innerText()), 'tâche absente du tableau de bord de l’adjoint');
  must(Number(sql(`select count(*) from public.notifications where user_id = '${adjId}' and kind = 'tache' and title = 'Nouvelle tâche' and body like 'Monter la vidéo recette%'`)) >= 1, 'notification absente');
  await adj.goto(`${BASE}/taches`);
  await adj.getByRole('checkbox', { name: /Monter la vidéo recette/ }).check();
  await adj.waitForFunction(() => !document.body.innerText.includes('Monter la vidéo recette') || document.querySelector('li.opacity-70'));
  must(sql("select status from public.staff_tasks where title = 'Monter la vidéo recette'") === 'terminee', 'tâche non terminée');
  await adj.goto(`${BASE}/taches?vue=terminees`);
  await adj.getByText('Monter la vidéo recette').waitFor();
  await shot(adj, '05-taches');
  log('adjoint : notifiée, voit la tâche sur son tableau de bord, la coche comme terminée');

  // 5. Droits
  const comm = await login(browser, 'comm.test@yfc.test');
  for (const url of ['/tactique/adversaires', `/impression/avant-match/${matchId}`, '/rapports/performance']) {
    await comm.goto(`${BASE}${url}`);
    must(/acces-refuse/.test(comm.url()), `communication accède à ${url}`);
  }
  await comm.goto(`${BASE}/taches?vue=toutes`);
  must(await comm.getByRole('checkbox', { name: /Monter la vidéo/ }).count() === 0 || await comm.getByRole('checkbox', { name: /Monter la vidéo/ }).isDisabled(), 'communication peut modifier une tâche qui ne la concerne pas');
  log('droits : adversaires et rapports refusés à la communication ; tâches d’autrui non modifiables');

  // 6. Mobile
  const mob = await login(browser, 'coach.test@yfc.test', { width: 390, height: 844 });
  for (const url of ['/tactique/adversaires', `/tactique/adversaires/${oppId}`, '/taches?vue=toutes', '/rapports/performance', '/tableau-de-bord']) {
    await mob.goto(`${BASE}${url}`);
    const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(over <= 1, `débordement horizontal ${over}px sur ${url}`);
  }
  await mob.goto(`${BASE}/tactique/adversaires/${oppId}`);
  await shot(mob, '06-mobile-adversaire');
  log('mobile 390 px : 5 écrans sans débordement horizontal');

  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`\nRecette livraison 4 : ${n} étapes OK, aucune erreur JS ni serveur.`);
})().catch((e) => { console.error('✘', e.message, '\n', errors.join('\n')); process.exit(1); });
