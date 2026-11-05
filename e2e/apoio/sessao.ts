import { Locator, Page, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tokenDaMatricula, tokenDe, UsuarioDev } from './api';

export const URL_LOGIN = '**/api/v1/auth/login';

/**
 * Simula o login pelo Windows (RN23, ADR 0054): o POST /auth/login responde com o token informado, como a API responderia ao
 * usuário do Windows. Não há Windows nos E2E; o token é um JWT de verdade do banco local (api.ts), e o resto da API é o real.
 * Vale para a página até o fim do teste (recarregar e navegar entram de novo com o mesmo usuário).
 */
export async function simularLoginWindows(page: Page, token: string): Promise<void> {
  await page.unroute(URL_LOGIN);
  await page.route(URL_LOGIN, (rota) =>
    rota.fulfill({ status: 200, json: { token, expiraEm: new Date(Date.now() + 8 * 3600_000).toISOString() } }),
  );
}

/** Simula o navegador sem credencial do Windows: o login responde 401 (como a API), e o front mostra a tela de acesso. */
export async function simularSemWindows(page: Page): Promise<void> {
  await page.unroute(URL_LOGIN);
  await page.route(URL_LOGIN, (rota) =>
    rota.fulfill({ status: 401, headers: { 'WWW-Authenticate': 'Negotiate' }, json: { codigo: 'NAO_AUTENTICADO' } }),
  );
}

/** Abre o front já logado como o usuário de exemplo (login pelo Windows simulado). */
export async function entrarComo(page: Page, usuario: UsuarioDev, caminho = '/'): Promise<void> {
  await entrarComToken(page, tokenDe(usuario), caminho);
}

/** O mesmo que entrarComo, com o token de um usuário criado no próprio teste. */
export async function entrarComToken(page: Page, token: string, caminho = '/'): Promise<void> {
  await simularLoginWindows(page, token);
  // A tela inicial é a última área usada (ou a primeira por nome): os testes partem de Testes de Desempenho, qualquer que seja o
  // resto do banco local. Se o teste trocar de área, a troca vale (só preenche quando ainda não há área guardada).
  await page.addInitScript((area) => {
    try {
      localStorage.getItem('catalogo.ultimaListagem') ?? localStorage.setItem('catalogo.ultimaListagem', area);
    } catch {
      // Sem localStorage: vale a primeira área.
    }
  }, 'testes_desempenho');
  await page.goto(caminho);
  await expect(botaoMenuUsuario(page)).toBeVisible();
}

/** Entra como a matrícula (ex.: um usuário criado no teste), pelo login do Windows simulado. */
export async function entrarComoMatricula(page: Page, matricula: string, caminho = '/'): Promise<void> {
  await entrarComToken(page, tokenDaMatricula(matricula), caminho);
}

/** O avatar do cabeçalho, que abre o menu do usuário (Minha conta, Tema e Sair). Indica que a pessoa está logada. */
export function botaoMenuUsuario(page: Page): Locator {
  return page.getByRole('button', { name: /^Menu do usuário/ });
}

/** Abre o menu do usuário e clica num item dele ("Minha conta", "Sair"). */
export async function noMenuDoUsuario(page: Page, item: 'Minha conta' | 'Sair'): Promise<void> {
  await botaoMenuUsuario(page).click();
  const menu = page.getByRole('dialog', { name: 'Menu do usuário' });
  await expect(menu).toBeVisible();
  await (
    item === 'Minha conta' ? menu.getByRole('link', { name: item }) : menu.getByRole('button', { name: item })
  ).click();
}

/**
 * Ações de uma linha de tabela ("⋯"): abre o menu "Ações de <rótulo>" e clica na ação. As tabelas têm um botão só por linha, preso à
 * direita (docs/design/guia-de-interface.md → "Tabelas").
 */
export async function acaoDaLinha(escopo: Page | Locator, rotulo: string, acao: string): Promise<void> {
  await escopo.getByRole('button', { name: `Ações de ${rotulo}`, exact: true }).click();
  const pagina = 'page' in escopo ? escopo.page() : escopo;
  await pagina.getByRole('menuitem', { name: acao, exact: true }).click();
}

/** Captura só da área visível: diálogos e menus abertos continuam na imagem (a página inteira os fecha). */
export async function capturarTela(page: Page, nome: string): Promise<void> {
  const pasta = join(__dirname, '..', 'capturas');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: join(pasta, `${nome}.png`) });
}

/** Captura de tela pedida na validação (pasta e2e/capturas/, fora do git). */
export async function capturar(page: Page, nome: string): Promise<void> {
  const pasta = join(__dirname, '..', 'capturas');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: join(pasta, `${nome}.png`), fullPage: true });
}

type Escopo = Page | Locator;

/**
 * Os campos são achados pelo PAPEL e pelo NOME ACESSÍVEL (o rótulo), como um leitor de tela os encontra. Campos
 * obrigatórios têm "(obrigatório)" no nome: use expressões como /^Projeto/.
 */
export function campoTexto(escopo: Escopo, nome: string | RegExp): Locator {
  return escopo.getByRole('textbox', { name: nome });
}

export function campoNumero(escopo: Escopo, nome: string | RegExp): Locator {
  return escopo.getByRole('spinbutton', { name: nome });
}

/** Um campo de qualquer tipo pelo nome acessível (texto, número, select, datepicker ou busca). */
export function campo(escopo: Escopo, nome: string | RegExp): Locator {
  return escopo
    .getByRole('textbox', { name: nome })
    .or(escopo.getByRole('spinbutton', { name: nome }))
    .or(escopo.getByRole('combobox', { name: nome }))
    .or(escopo.getByRole('searchbox', { name: nome }));
}

/** Selects (referência, lista) e datepickers têm o papel "combobox". */
export function campoSelecao(escopo: Escopo, nome: string | RegExp): Locator {
  return escopo.getByRole('combobox', { name: nome });
}

/** Escolhe uma opção num campo LISTA (p-select): abre o combobox e clica na opção. */
export async function escolherOpcao(escopo: Escopo, nome: string | RegExp, opcao: string): Promise<void> {
  await campoSelecao(escopo, nome).click();
  const pagina = 'page' in escopo ? escopo.page() : escopo;
  await pagina.getByRole('option', { name: opcao, exact: true }).click();
}

/** Escolhe uma opção num select de referência (p-autocomplete): digita, espera a lista do servidor e clica. */
export async function escolherReferencia(
  escopo: Escopo,
  nome: string | RegExp,
  busca: string,
  opcao: string | RegExp,
): Promise<void> {
  const campo = campoSelecao(escopo, nome);
  await campo.click();
  // Na edição o campo já mostra o rótulo atual: apaga antes de digitar a busca.
  await campo.clear();
  await campo.pressSequentially(busca, { delay: 30 });
  const pagina = 'page' in escopo ? escopo.page() : escopo;
  await pagina.getByRole('option', { name: opcao }).first().click();
}

/** Digita uma data no datepicker (dd/mm/aaaa ou dd/mm/aaaa hh:mm), tecla a tecla, e sai do campo. */
export async function digitarData(escopo: Escopo, nome: string | RegExp, texto: string): Promise<void> {
  const campo = campoSelecao(escopo, nome);
  await campo.click();
  await campo.pressSequentially(texto, { delay: 20 });
  await campo.press('Tab');
}
