/* eslint-disable @typescript-eslint/no-require-imports */
// Recette Phase 1 (Playwright). Prérequis : pile Supabase locale réinitialisée, admin amorcé
// (direction.test@yfc.test), application sur http://localhost:3000.
// Usage : node tests/e2e/recette-phase1.cjs <dossier-captures>
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const MAIL = 'http://127.0.0.1:54324/api/v1';
const shots = process.argv[2];
async function lastLink(to) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAIL}/search?query=to:${encodeURIComponent(to)}`)).json();
    if (list.messages?.length) {
      const m = await (await fetch(`${MAIL}/message/${list.messages[0].ID}`)).json();
      const link = (m.HTML || m.Text).match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
      return { subject: m.Subject, link };
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('no mail for ' + to);
}
const log = (...a) => console.log('✔', ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  // 1. Mot de passe oublié -> lien -> définir mot de passe
  await page.goto(`${BASE}/mot-de-passe-oublie`);
  await page.fill('input[name=email]', 'direction.test@yfc.test');
  await page.click('button[type=submit]');
  await page.getByRole('status').waitFor();
  const r = await lastLink('direction.test@yfc.test');
  log('mail', r.subject);
  await page.goto(r.link);
  await page.waitForURL('**/definir-mot-de-passe');
  await page.fill('input[name=password]', 'Admin-Test-2026');
  await page.fill('input[name=confirm]', 'Admin-Test-2026');
  await page.click('button[type=submit]');
  await page.waitForURL('**/tableau-de-bord');
  log('admin connecté');
  await page.screenshot({ path: `${shots}/01-dashboard-vide.png`, fullPage: true });
  // 2. Saison + compétition
  await page.goto(`${BASE}/administration/parametres`);
  await page.fill('input[name=label]', '2026-2027');
  await page.fill('#s_starts_on', '2026-09-01');
  await page.fill('#s_ends_on', '2027-06-30');
  await page.getByRole('button', { name: 'Créer la saison' }).click();
  await page.getByText('Saison créée.').waitFor();
  await page.reload();
  await page.fill('#c_name', 'TEST Compétition');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await page.getByText('Compétition créée.').waitFor();
  log('saison + compétition');
  // 3. Joueuse
  await page.goto(`${BASE}/effectif/nouvelle`);
  await page.fill('#first_name', 'Fixture');
  await page.fill('#last_name', 'Test');
  await page.fill('#birth_date', '2004-05-12');
  await page.selectOption('#primary_position', { label: 'N6 — Sentinelle — N°6' });
  await page.fill('#shirt_number', '6');
  await page.setInputFiles('#photo', require('path').join(__dirname, 'fixtures/photo.jpg'));
  await page.getByRole('button', { name: 'Créer la fiche' }).click();
  await page.waitForURL(/\/effectif\/[0-9a-f-]{36}/);
  log('joueuse créée', page.url());
  const playerUrl = page.url().split('?')[0];
  // doublon de numéro
  await page.goto(`${BASE}/effectif/nouvelle`);
  await page.fill('#first_name', 'Fixture'); await page.fill('#last_name', 'Doublon'); await page.fill('#shirt_number', '6');
  await page.getByRole('button', { name: 'Créer la fiche' }).click();
  await page.getByText('Ce numéro de maillot est déjà attribué cette saison.').waitFor();
  log('doublon de numéro refusé');
  // 4. Disponibilité + document
  await page.goto(playerUrl);
  await page.selectOption('#kind', 'licence');
  await page.fill('#title', 'Licence TEST');
  await page.fill('#expires_on', '2026-12-10');
  await page.setInputFiles('#file', require('path').join(__dirname, 'fixtures/doc.pdf'));
  await page.getByRole('button', { name: 'Ajouter le document' }).click();
  await page.getByText('Document ajouté.').waitFor();
  log('document');
  await page.reload();
  await page.screenshot({ path: `${shots}/03-fiche-joueuse.png`, fullPage: true });
  // 5. Staff
  await page.goto(`${BASE}/staff/nouveau`);
  await page.fill('#first_name', 'Fixture'); await page.fill('#last_name', 'Coach');
  await page.selectOption('#role_id', { label: 'Entraîneur principal' });
  await page.fill('#email', 'coach.test@yfc.test');
  await page.getByRole('button', { name: 'Créer la fiche' }).click();
  await page.waitForURL('**/staff?ok=1');
  log('staff créé');
  // 6. Invitation entraîneur
  await page.goto(`${BASE}/administration/utilisateurs`);
  await page.fill('#full_name', 'Compte Test Entraîneur');
  await page.fill('#email', 'coach.test@yfc.test');
  await page.selectOption('#role_id', { label: 'Entraîneur principal' });
  await page.getByRole('button', { name: /Inviter/ }).click();
  await page.getByText(/Invitation envoyée/).waitFor();
  log('invitation envoyée');
  // 7. Tableau de bord rempli (sombre, clair, mobile)
  await page.goto(`${BASE}/tableau-de-bord`);
  await page.screenshot({ path: `${shots}/02-dashboard-sombre.png`, fullPage: true });
  await page.getByRole('button', { name: /Basculer/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/04-dashboard-clair.png`, fullPage: true });
  await page.getByRole('button', { name: /Basculer/ }).click();
  await page.goto(`${BASE}/administration/journal`);
  await page.screenshot({ path: `${shots}/05-journal.png` });
  await page.goto(`${BASE}/administration/roles`);
  await page.screenshot({ path: `${shots}/06-roles.png` });
  // 8. Entraîneur : activation + restrictions
  const coach = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  const cp = await coach.newPage();
  const inv = await lastLink('coach.test@yfc.test');
  log('mail invitation :', inv.subject);
  await cp.goto(inv.link);
  await cp.waitForURL('**/definir-mot-de-passe');
  await cp.fill('input[name=password]', 'Coach-Test-2026'); await cp.fill('input[name=confirm]', 'Coach-Test-2026');
  await cp.click('button[type=submit]');
  await cp.waitForURL('**/tableau-de-bord');
  await cp.screenshot({ path: `${shots}/07-mobile-entraineur.png` });
  await cp.goto(`${BASE}/administration/utilisateurs`);
  if (!cp.url().includes('/acces-refuse')) throw new Error('coach a accès aux utilisateurs !');
  log('entraîneur bloqué sur Utilisateurs');
  await cp.goto(`${BASE}/documents`);
  if (!cp.url().includes('/acces-refuse')) throw new Error('coach a accès aux documents !');
  log('entraîneur bloqué sur Documents');
  const ex = await cp.request.get(`${BASE}/administration/sauvegardes/export`);
  if (ex.status() !== 403) throw new Error('export accessible au coach');
  log('export refusé au coach (403)');
  await cp.goto(playerUrl);
  await cp.selectOption('#reason', 'blessure');
  await cp.fill('#sporting_note', 'Reprise individualisée');
  await cp.getByRole('button', { name: 'Enregistrer' }).click();
  await cp.getByText('Disponibilité enregistrée.').waitFor();
  log('disponibilité déclarée par l\'entraîneur');
  await cp.reload();
  await cp.screenshot({ path: `${shots}/08-mobile-fiche.png`, fullPage: true });
  const exA = await page.request.get(`${BASE}/administration/sauvegardes/export`);
  const j = await exA.json(); log('export admin', exA.status(), 'joueuses:', j.players.length);
  await browser.close();
})().catch(e => { console.error('ÉCHEC', e); process.exit(1); });
