import { expect, test } from '@playwright/test';
import { tokenDe } from './apoio/api';
import { URL_LOGIN, botaoMenuUsuario, capturar, noMenuDoUsuario, simularLoginWindows } from './apoio/sessao';

// RN23 (login pelo Windows, ADR 0054): não há tela de login. Ao abrir, o front chama POST /auth/login com as credenciais do
// navegador e guarda o JWT. Nos E2E o Windows é simulado: o login responde com o token de um usuário do banco local.
test.describe('Acesso pelo Windows', () => {
  test('abre direto, já logado, sem pedir matrícula nem senha', async ({ page }) => {
    const chamadas: { metodo: string; corpo: string | null }[] = [];
    await simularLoginWindows(page, tokenDe('dev.interno'));
    page.on('request', (r) => {
      if (r.url().endsWith('/api/v1/auth/login')) {
        chamadas.push({ metodo: r.method(), corpo: r.postData() });
      }
    });

    await page.goto('/');

    await expect(botaoMenuUsuario(page)).toBeVisible();
    await expect(page).not.toHaveURL(/\/acesso/);
    await expect(page.getByLabel('Matrícula')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(chamadas).toEqual([{ metodo: 'POST', corpo: null }]);
    // O menu do usuário não tem mais "Trocar senha".
    await botaoMenuUsuario(page).click();
    const menu = page.getByRole('dialog', { name: 'Menu do usuário' });
    await expect(menu.getByText('dev.interno')).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Trocar senha' })).toHaveCount(0);
  });

  test('usuário recusado (403, desativado): acesso negado, e "Tentar de novo" entra quando liberar', async ({
    page,
  }) => {
    await page.route(URL_LOGIN, (rota) =>
      rota.fulfill({ status: 403, json: { codigo: 'SEM_PERMISSAO', traceId: 't', title: 'Sem permissão.' } }),
    );

    await page.goto('/testes_desempenho');

    await expect(page).toHaveURL(/\/acesso/);
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('procure um administrador');
    await capturar(page, '01-acesso-negado');

    await simularLoginWindows(page, tokenDe('dev.interno'));
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(botaoMenuUsuario(page)).toBeVisible();
    // Volta para onde a pessoa ia (o returnUrl).
    await expect(page).toHaveURL(/\/testes_desempenho$/);
  });

  test('sem credencial do Windows (401): acesso negado', async ({ page }) => {
    await page.route(URL_LOGIN, (rota) =>
      rota.fulfill({ status: 401, headers: { 'WWW-Authenticate': 'Negotiate' }, json: { codigo: 'NAO_AUTENTICADO' } }),
    );

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible();
  });

  test('API fora do ar: Catálogo indisponível', async ({ page }) => {
    await page.route(URL_LOGIN, (rota) => rota.abort('connectionrefused'));

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Catálogo indisponível' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  });

  test('Sair mostra "Você saiu" e só entra de novo pelo botão', async ({ page }) => {
    await simularLoginWindows(page, tokenDe('dev.externo'));
    await page.goto('/');
    await expect(botaoMenuUsuario(page)).toBeVisible();

    await noMenuDoUsuario(page, 'Sair');

    await expect(page).toHaveURL(/\/acesso/);
    await expect(page.getByRole('heading', { name: 'Você saiu' })).toBeVisible();
    await expect(botaoMenuUsuario(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Entrar de novo' }).click();
    await expect(botaoMenuUsuario(page)).toBeVisible();
  });

  test('endereços antigos de login e troca de senha levam à tela inicial', async ({ page }) => {
    await simularLoginWindows(page, tokenDe('dev.interno'));
    for (const antigo of ['/login', '/trocar-senha']) {
      await page.goto(antigo);
      await expect(botaoMenuUsuario(page)).toBeVisible();
      await expect(page).not.toHaveURL(/\/(login|trocar-senha|acesso)/);
    }
  });
});
