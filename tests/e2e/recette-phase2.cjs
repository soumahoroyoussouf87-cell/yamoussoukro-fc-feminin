/* eslint-disable @typescript-eslint/no-require-imports */
// Recette Phase 2 (Playwright) sur la pile Supabase LOCALE.
// Prérequis : `supabase db reset` + application sur http://localhost:3000 (next start).
// Usage : node tests/e2e/recette-phase2.cjs <dossier-captures>
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const shots = process.argv[2] || '/tmp/recette2';
fs.mkdirSync(shots, { recursive: true });
const env = Object.fromEntries(execSync('npx supabase status -o env', { encoding: 'utf8' }).split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const PW = 'Recette-Phase2-2026';
const iso = (d) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
let n = 0;
const log = (...a) => console.log(`✔ ${String(++n).padStart(2, '0')}`, ...a);
const errors = [];
const pages = [];

async function createUsers() {
  execSync('npx supabase db reset', { stdio: 'ignore' });
  for (const email of ['coach.test@yfc.test', 'adjoint.test@yfc.test', 'comm.test@yfc.test', 'tm.test@yfc.test']) {
    const r = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
      method: 'POST', headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PW, email_confirm: true, user_metadata: { full_name: email.split('.')[0] } }),
    });
    if (!r.ok) throw new Error(`user ${email}: ${await r.text()}`);
  }
  execSync(`psql "${env.DB_URL}" -v ON_ERROR_STOP=1 -q -f tests/e2e/fixtures/phase2-setup.sql`, { stdio: 'inherit' });
}

async function session(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  pages.push(page);
  page.on('pageerror', (e) => errors.push(`${email} PAGEERROR ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`${email} HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`${BASE}/connexion`);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL('**/tableau-de-bord');
  return page;
}
async function createSheet(page, date, theme) {
  await page.goto(`${BASE}/entrainement/seances/nouvelle?date=${date}`);
  await page.getByRole('button', { name: 'Créer la séance' }).click();
  await page.waitForURL(/etape=1/);
  const id = page.url().match(/seances\/([0-9a-f-]+)/)[1];
  await page.fill('#starts_at', '09:00');
  await page.fill('#ends_at', '10:30');
  await page.fill('#location', 'Stade de Yamoussoukro');
  await page.selectOption('#intensity', 'moderee');
  await page.selectOption('#game_system', '4-3-3');
  await page.getByText(/Enregistré à/).first().waitFor();
  await page.goto(`${BASE}/entrainement/seances/${id}?etape=2`);
  await page.fill('#new-main', theme);
  await page.getByRole('button', { name: 'Créer' }).first().click();
  await page.waitForFunction((t) => document.querySelector('#theme_id')?.selectedOptions[0]?.textContent === t, theme);
  await page.fill('#main_objective', 'Progresser collectivement');
  await page.getByText(/Enregistré à/).first().waitFor();
  return id;
}
const shot = (page, name) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const status = (page, text) => page.getByRole('status').filter({ hasText: text }).first().waitFor({ timeout: 15000 });
const submit = (page, name) => page.getByRole('button', { name, exact: true }).click();
async function expectText(page, text) { await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 }); }

(async () => {
  await createUsers();
  log('jeu de recette local : 4 comptes, saison, compétition, 22 joueuses');
  const browser = await chromium.launch();
  const coach = await session(browser, 'coach.test@yfc.test');
  log('connexion entraîneur principal');

  // --- Bibliothèque d'exercices
  for (const [title, cat] of [['Rondo 5c2', 'technique_offensive'], ['Jeu de position 8c8', 'tactique_offensive']]) {
    await coach.goto(`${BASE}/entrainement/exercices/nouveau`);
    await coach.fill('[name=title]', title);
    await coach.selectOption('[name=category]', cat);
    await coach.fill('[name=objective]', 'Conservation sous pression');
    await coach.fill('[name=duration_min]', '15');
    await coach.setInputFiles('[name=diagram]', 'tests/e2e/fixtures/photo.jpg');
    await submit(coach, "Créer l'exercice");
    await coach.waitForURL('**/entrainement/exercices/*/modifier');
    await coach.getByText('Tableau tactique').first().waitFor();
  }
  await expectText(coach, 'Schéma');
  await coach.goto(`${BASE}/entrainement/exercices?categorie=tactique_offensive`);
  await expectText(coach, 'Jeu de position 8c8');
  await shot(coach, '01-bibliotheque');
  log('bibliothèque : 2 exercices créés avec schéma, filtre par catégorie');

  // --- Rencontre
  await coach.goto(`${BASE}/competition/rencontres/nouvelle`);
  await coach.fill('[name=new_opponent]', 'ASEC Mimosas (recette)');
  await coach.fill('[name=match_date]', iso(3));
  await coach.fill('[name=match_time]', '16:00');
  await coach.fill('[name=venue]', 'Stade de Yamoussoukro');
  await coach.fill('[name=matchday]', 'J1');
  await submit(coach, 'Créer le match');
  await coach.waitForURL('**/competition/rencontres/*?ok=1');
  const matchId = coach.url().split('/rencontres/')[1].split('?')[0];
  await expectText(coach, 'J-3');
  await shot(coach, '02-match-center');
  log('rencontre créée, Match Center affiché (J-3)');

  // --- Programme hebdomadaire + séance
  await coach.goto(`${BASE}/planification/programme?semaine=${iso(1)}`);
  await coach.getByRole('button', { name: 'Ouvrir le microcycle' }).click();
  await expectText(coach, 'Statut');
  const sessionId = await createSheet(coach, iso(1), 'Sortie de balle');
  await coach.goto(`${BASE}/entrainement/seances/${sessionId}?etape=3`);
  for (const [block, idx] of [['echauffement', 1], ['jeu_dirige', 2]]) {
    await coach.selectOption('#new-phase-block', block);
    await coach.getByRole('button', { name: 'Ajouter la phase' }).click();
    await coach.getByRole('heading', { name: block === 'echauffement' ? 'Échauffement' : 'Jeu dirigé' }).waitFor();
    const sel = coach.locator('[aria-label="Exercice de la bibliothèque"]').last();
    await sel.selectOption({ index: idx });
    await coach.getByRole('button', { name: 'Ajouter', exact: true }).last().click();
    await coach.waitForFunction((n) => document.querySelectorAll('input[id^="d-"]').length === n, idx);
    const d = coach.locator('input[id^="d-"]').nth(idx - 1);
    await d.fill('20');
  }
  await coach.waitForTimeout(2000);
  await coach.reload();
  await expectText(coach, '40 min');
  await expectText(coach, 'Séance n°1');
  await coach.goto(`${BASE}/entrainement/seances/${sessionId}?etape=4`);
  for (let k = 0; k < 2; k++) {
    await coach.locator('nav[aria-label="Exercices de la séance"] button').nth(k).click();
    await coach.fill('#ex-instructions', 'Circulation rapide, appuis et soutiens.');
    await coach.getByText(/Enregistré à/).first().waitFor();
  }
  log('séance n°1 créée (numéro automatique), 2 exercices de la bibliothèque, durée totale 40 min');
  await coach.goto(`${BASE}/entrainement/seances/${sessionId}?etape=8`);
  await submit(coach, 'Valider');
  await coach.getByText('Validé', { exact: true }).first().waitFor();
  await submit(coach, 'Publier');
  await coach.getByText('Publié', { exact: true }).first().waitFor();
  await coach.getByText('Historique des validations').click();
  await expectText(coach, '→');
  await shot(coach, '03-seance-publiee');
  log('workflow séance : Brouillon → Validé → Publié, historique tracé');

  await coach.goto(`${BASE}/entrainement/seances/${sessionId}?etape=5`);
  await coach.getByRole('button', { name: /Présentes : les disponibles/ }).click();
  await coach.locator('[aria-label^="Présence de"]').nth(3).selectOption('blessee');
  await coach.getByText(/Enregistré à/).first().waitFor();
  await coach.reload();
  await expectText(coach, '22/22 saisies');
  log('présences : 22 saisies (dont 1 blessée)');
  await coach.goto(`${BASE}/entrainement/seances/${sessionId}?etape=7`);
  await coach.locator('[role=radiogroup]').first().getByRole('radio', { name: '4' }).click();
  await coach.fill('#strengths', 'Bonne circulation');
  await coach.getByText(/Enregistré à/).first().waitFor();
  log('évaluation post-séance enregistrée');

  await coach.goto(`${BASE}/planification/evenements/nouveau?date=${iso(2)}`);
  await coach.selectOption('[name=type]', 'seance_video');
  await coach.fill('[name=title]', 'Analyse vidéo adversaire');
  await coach.fill('[name=starts_at]', '17:00');
  await submit(coach, "Créer l'activité");
  await coach.waitForURL('**/planification/programme?semaine=*');
  await expectText(coach, 'Analyse vidéo adversaire');
  await shot(coach, '04-programme');
  log('activité ajoutée, programme hebdomadaire avec références J');

  for (const v of ['jour', 'semaine', 'mois', 'annee']) {
    await coach.goto(`${BASE}/planification/calendrier?vue=${v}&date=${iso(1)}`);
    await coach.getByRole('heading', { level: 2 }).first().waitFor();
    await shot(coach, `05-calendrier-${v}`);
  }
  log('calendrier : vues jour, semaine, mois, année');

  await coach.goto(`${BASE}/planification/cycles`);
  await coach.fill('[name=name]', 'Phase aller');
  await coach.locator('[name=starts_on]').first().fill(iso(-30));
  await coach.locator('[name=ends_on]').first().fill(iso(90));
  await submit(coach, 'Créer le macrocycle');
  await coach.waitForURL('**/planification/cycles?ok=1');
  await coach.locator('form', { hasText: 'Créer le mésocycle' }).locator('[name=name]').fill('Bloc 1');
  await coach.locator('form', { hasText: 'Créer le mésocycle' }).locator('[name=starts_on]').fill(iso(-7));
  await coach.locator('form', { hasText: 'Créer le mésocycle' }).locator('[name=ends_on]').fill(iso(21));
  await submit(coach, 'Créer le mésocycle');
  await coach.waitForURL('**/planification/cycles?ok=1*');
  await expectText(coach, 'Bloc 1');
  log('macrocycle et mésocycle créés');

  // --- Convocation
  await coach.goto(`${BASE}/competition/rencontres/${matchId}/convocations`);
  await coach.getByRole('button', { name: 'Créer la convocation' }).click();
  const sel = coach.locator('select[name^=st_]');
  await sel.first().waitFor();
  for (let i = 0; i < 19; i++) await sel.nth(i).selectOption('convoquee');
  await expectText(coach, 'liste trop longue');
  if (!(await coach.getByRole('button', { name: 'Enregistrer la convocation' }).isDisabled())) throw new Error('limite 18 non appliquée');
  await sel.nth(18).selectOption('reserviste');
  await sel.nth(19).selectOption('reserviste');
  await sel.nth(20).selectOption('non_retenue');
  await coach.locator('input[name^=cm_]').first().fill('Manque de rythme — confidentiel');
  await submit(coach, 'Enregistrer la convocation');
  await status(coach, '18 convoquée(s), 2 réserviste(s)');
  await submit(coach, 'Valider');
  await expectText(coach, 'Validé');
  await submit(coach, 'Publier');
  await coach.getByText('Publié', { exact: true }).first().waitFor();
  await shot(coach, '06-convocation');
  log('convocation : limite 18 bloquante, 18 convoquées + 2 réservistes, commentaire confidentiel, validée puis publiée');

  // --- Onze
  await coach.goto(`${BASE}/competition/rencontres/${matchId}/onze`);
  await expectText(coach, 'Joueuses disponibles');
  const avail = () => coach.locator('aside ul').last().locator('li > button:first-child');
  for (let i = 0; i < 11; i++) await avail().first().click();
  await coach.locator('aside ul').last().getByRole('button', { name: 'Banc' }).first().click();
  await coach.locator('aside ul').last().getByRole('button', { name: 'Banc' }).first().click();
  await coach.getByRole('button', { name: /^N9 :/ }).click();
  await coach.getByLabel('Capitaine').check();
  await coach.getByLabel('Penalties').check();
  await submit(coach, 'Enregistrer');
  await coach.waitForURL('**/onze?compo=*');
  await expectText(coach, 'Provisoire');
  await shot(coach, '07-onze-provisoire');
  log('onze : 11 titulaires + 2 remplaçantes, capitaine, tireuse de penalties, enregistré en provisoire');
  await coach.getByRole('button', { name: 'Valider (officielle)' }).click();
  await expectText(coach, 'Validée (officielle)');
  await coach.getByRole('button', { name: 'Autoriser la communication' }).click();
  await coach.getByText('Communiquée').first().waitFor();
  const [dl] = await Promise.all([coach.waitForEvent('download'), coach.getByRole('button', { name: 'PNG' }).click()]);
  await dl.saveAs(`${shots}/08-onze-export.png`);
  log('onze validé puis communiqué ; export PNG téléchargé');

  // --- Délégation
  await coach.goto(`${BASE}/competition/rencontres/${matchId}/delegation`);
  await coach.getByRole('button', { name: 'Créer la délégation' }).click();
  await coach.locator('[name=transport]').waitFor();
  await coach.fill('[name=transport]', 'Car du club');
  await coach.fill('[name=budget_planned]', '450000');
  await coach.fill('[name=schedule]', '13h00 départ du centre\n14h30 arrivée au stade');
  await submit(coach, 'Enregistrer la délégation');
  await status(coach, 'Délégation enregistrée');
  await coach.getByRole('button', { name: 'Importer les joueuses convoquées' }).click();
  await expectText(coach, 'Joueuses (18)');
  await coach.getByText('Ajouter un membre').click();
  await coach.selectOption('[name=member_group]', 'staff_technique');
  await coach.selectOption('[name=staff_member_id]', { index: 1 });
  await submit(coach, 'Ajouter');
  await status(coach, 'Membre ajouté');
  await submit(coach, 'Soumettre à validation');
  await expectText(coach, 'Soumis');
  await submit(coach, 'Valider');
  await expectText(coach, 'Validé');
  log('délégation : infos, 18 joueuses importées + staff, soumise puis validée');

  // --- Pendant le match
  await coach.goto(`${BASE}/competition/rencontres/${matchId}/direct`);
  await coach.selectOption('[name=type]', 'but');
  await coach.fill('[name=minute]', '23');
  await coach.selectOption('[name=player_id]', { index: 10 });
  await coach.selectOption('[name=related_player_id]', { index: 8 });
  await submit(coach, 'Ajouter');
  await status(coach, 'Événement ajouté');
  await coach.selectOption('[name=type]', 'remplacement');
  await coach.selectOption('[name=period]', '2MT');
  await coach.fill('[name=minute]', '70');
  await coach.selectOption('[name=player_id]', { index: 10 });
  await coach.selectOption('[name=related_player_id]', { index: 12 });
  await submit(coach, 'Ajouter');
  await coach.getByText('Sortie :').waitFor();
  await coach.selectOption('[name=type]', 'remplacement');
  await coach.fill('[name=minute]', '75');
  await coach.selectOption('[name=player_id]', { index: 0 });
  await submit(coach, 'Ajouter');
  await expectText(coach, 'Joueuse requise');
  await coach.getByRole('button', { name: /Enregistrer le score final 1-0/ }).click();
  await coach.getByText('Joué').first().waitFor();
  await shot(coach, '09-direct');
  log('événements : but + passe, remplacement ; contrôle « joueuse requise » ; score 1-0 enregistré');

  await coach.goto(`${BASE}/competition/rencontres/${matchId}/rapport`);
  await coach.fill('[name=post_report]', 'Match maîtrisé en première période.');
  await coach.fill('[name=development_axes]', 'Transitions défensives');
  await submit(coach, 'Enregistrer');
  await status(coach, 'Résultat et rapport enregistrés');
  await expectText(coach, 'composition officielle');
  await shot(coach, '10-apres-match');
  log('après-match : rapport et statistiques du match (minutes depuis la composition officielle)');

  // --- Classement / résultats / stats
  await coach.goto(`${BASE}/competition/classement`);
  for (const [team, own, pos, pts] of [['YFC Féminin', 'true', '1', '3'], ['Africa Sports', 'false', '2', '1']]) {
    await coach.fill('[name=team_name]', team);
    await coach.selectOption('[name=is_own_team]', own);
    await coach.fill('[name=position]', pos);
    await coach.fill('[name=played]', '1');
    await coach.fill('[name=won]', own === 'true' ? '1' : '0');
    await coach.fill('[name=drawn]', own === 'true' ? '0' : '1');
    await coach.fill('[name=points]', pts);
    await submit(coach, 'Ajouter');
    await status(coach, 'Ligne ajoutée');
  }
  await coach.fill('[name=team_name]', 'Incohérente');
  await coach.fill('[name=position]', '3');
  await coach.fill('[name=played]', '2');
  await submit(coach, 'Ajouter');
  await expectText(coach, 'V + N + D doit égaler');
  await coach.reload();
  await shot(coach, '11-classement');
  log('classement : 2 équipes saisies, contrôle de cohérence V+N+D=J');
  await coach.goto(`${BASE}/competition/resultats`);
  await expectText(coach, 'Victoire');
  await coach.goto(`${BASE}/competition/statistiques`);
  await expectText(coach, 'Minutes');
  await shot(coach, '12-statistiques');
  for (const p of ['/competition/convocations', '/competition/onze-de-depart', '/competition/delegations', '/rapports/matchs', '/rapports/documents', '/entrainement/presences', '/entrainement/evaluations', '/planification/microcycles', '/competition/match-center']) {
    await coach.goto(`${BASE}${p}`);
    await coach.locator('h1').first().waitFor();
  }
  log('résultats, statistiques, index convocations/onze/délégations, rapports, documents, présences, évaluations');

  // --- Documents imprimables
  for (const [p, name] of [[`/impression/convocation/${matchId}`, 'convocation'], [`/impression/delegation/${matchId}`, 'delegation'], [`/impression/onze/${matchId}`, 'onze'], [`/impression/programme?semaine=${iso(1)}`, 'programme']]) {
    await coach.goto(`${BASE}${p}`);
    await coach.locator('#document').waitFor();
    await coach.locator('#document').screenshot({ path: `${shots}/13-doc-${name}.png` });
  }
  await coach.goto(`${BASE}/impression/convocation/${matchId}`);
  if (await coach.getByText('Manque de rythme').count()) throw new Error('commentaire confidentiel imprimé');
  const [dl2] = await Promise.all([coach.waitForEvent('download'), coach.getByRole('button', { name: 'Exporter en PNG' }).click()]);
  await dl2.saveAs(`${shots}/13-convocation-export.png`);
  await coach.emulateMedia({ media: 'print' });
  await coach.pdf({ path: `${shots}/13-delegation.pdf`, format: 'A4' }).catch(() => {});
  await coach.emulateMedia({ media: 'screen' });
  log('documents : convocation (sans commentaire confidentiel, PNG), délégation avec signatures, onze, programme');

  await coach.goto(`${BASE}/tableau-de-bord`);
  await expectText(coach, 'Prochaine séance');
  await expectText(coach, 'Programme de la semaine');
  await shot(coach, '14-tableau-de-bord');
  log('tableau de bord : prochaine séance, programme de la semaine, classement, accès rapides actifs');

  // --- Entraîneur adjoint
  const adj = await session(browser, 'adjoint.test@yfc.test');
  await adj.goto(`${BASE}/notifications`);
  await expectText(adj, 'Nouvelle séance publiée');
  await expectText(adj, 'Convocation publiée');
  await adj.goto(`${BASE}/entrainement/seances/${sessionId}?etape=8`);
  await expectText(adj, 'Publié');
  await expectText(adj, 'Lecture seule');
  if (await adj.getByRole('button', { name: 'Archiver' }).count()) throw new Error('adjoint peut archiver');
  await adj.goto(`${BASE}/entrainement/seances/${sessionId}?etape=3`);
  if (await adj.getByRole('button', { name: 'Ajouter la phase' }).count()) throw new Error('adjoint peut modifier une séance publiée');
  const s2 = await createSheet(adj, iso(4), 'Pressing haut');
  await adj.goto(`${BASE}/entrainement/seances/${s2}?etape=3`);
  await adj.getByRole('button', { name: 'Ajouter la phase' }).waitFor();
  await adj.selectOption('#new-phase-block', 'jeu_dirige');
  await adj.getByRole('button', { name: 'Ajouter la phase' }).click();
  await adj.getByRole('heading', { name: 'Jeu dirigé' }).waitFor();
  await adj.locator('[aria-label="Exercice de la bibliothèque"]').selectOption({ index: 1 });
  await adj.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await adj.locator('input[id^="d-"]').first().waitFor();
  await adj.locator('input[id^="d-"]').first().fill('20');
  await adj.waitForTimeout(1500);
  await adj.goto(`${BASE}/entrainement/seances/${s2}?etape=8`);
  await expectText(adj, 'Séance n°2');
  if (await adj.getByRole('button', { name: 'Valider', exact: true }).count()) throw new Error('adjoint voit Valider');
  await submit(adj, 'Soumettre à validation');
  await adj.getByText('Soumis', { exact: true }).first().waitFor();
  log('adjoint : notifié, ne peut ni modifier ni archiver une séance publiée, crée la séance n°2 et la soumet (sans pouvoir valider)');

  // --- Communication
  const comm = await session(browser, 'comm.test@yfc.test');
  await comm.goto(`${BASE}/planification/calendrier`);
  await comm.waitForURL('**/acces-refuse*');
  await comm.goto(`${BASE}/competition/rencontres/${matchId}/onze`);
  await expectText(comm, 'Communiquée');
  if (await comm.getByRole('button', { name: 'Enregistrer' }).count()) throw new Error('communication peut modifier le onze');
  await comm.goto(`${BASE}/competition/rencontres/${matchId}/convocations`);
  await expectText(comm, 'Décision');
  if (await comm.getByText('Commentaire confidentiel').count()) throw new Error('communication voit les commentaires confidentiels');
  log('communication : planification refusée, onze communiqué en lecture seule, pas de commentaires confidentiels');

  // --- Team Manager
  const tm = await session(browser, 'tm.test@yfc.test');
  await tm.goto(`${BASE}/competition/rencontres/${matchId}/delegation`);
  await expectText(tm, 'Validé');
  if (await tm.locator('[name=transport]').count()) throw new Error('délégation validée modifiable par le team manager');
  await tm.goto(`${BASE}/competition/rencontres/${matchId}/onze`);
  await expectText(tm, 'Communiquée');
  log('team manager : délégation validée verrouillée, onze communiqué visible');

  await browser.close();
  if (errors.length) { console.log('ERREURS :\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nRecette Phase 2 : ${n} étapes réussies, aucune erreur serveur ni JavaScript.`);
})().catch(async (e) => {
  console.error('ÉCHEC', e.message, '\n' + errors.join('\n'));
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${shots}/ECHEC-${i}.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
