import { Page, expect, test } from '@playwright/test';
import { GRUPO, chamar, criar, idPor, listar, prefixoUnico, tokenDe } from './apoio/api';
import { habilitarNaListagem, limparE2E } from './apoio/limpeza';
import { botaoMenuUsuario, entrarComToken, noMenuDoUsuario, simularLoginWindows } from './apoio/sessao';
import { UsuarioTeste, criarUsuarioDeTeste } from './apoio/usuarios-teste';

/**
 * Contador de pendentes de aprovação (RN36, ADR 0045): só GESTOR e ADMINISTRADOR consultam a fila. EXTERNO e INTERNO navegam sem
 * nenhuma requisição a /aprovacoes/pendentes e sem nenhum aviso na tela, também quando entram na mesma aba depois de um GESTOR
 * (o bug: o contador do GESTOR continuava consultando a cada navegação, e a API respondia 403 com toast). O GESTOR continua vendo
 * o contador, consultado uma vez na carga e não a cada tela.
 *
 * O arquivo cria a PRÓPRIA equipe ("Equipe E2E-…"), habilitada em Testes de Desempenho (RN90), com a aprovação de Relatórios de
 * Teste ligada só nela e um item pendente, que o último teste aprova direto na fila; a limpeza fica com o helper compartilhado
 * (e2e/apoio/limpeza.ts).
 */

const prefixo = prefixoUnico();
const ENTIDADE = 'relatorio_teste';
const FILA = '/api/v1/aprovacoes/pendentes';

let equipeId = '';
let externo: UsuarioTeste;
let interno: UsuarioTeste;
let gestor: UsuarioTeste;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Cria a equipe, liga a aprovação e cria três usuários (o login pelo Windows é simulado).
  test.setTimeout(240_000);
  const admin = tokenDe('admin');
  await limparE2E(admin);
  const equipe = await chamar<{ id: string }>(admin, 'POST', '/equipes', { nome: `Equipe ${prefixo}` });
  expect(equipe.status, 'POST /equipes').toBe(201);
  equipeId = equipe.corpo.id;
  await habilitarNaListagem(admin, GRUPO, equipeId);
  const aprovacao = await chamar(
    admin,
    'PUT',
    `/equipes/${equipeId}/configuracoes/grupos/${GRUPO}/entidades/${ENTIDADE}/aprovacao`,
    { ativa: true },
  );
  expect(aprovacao.status, 'ligar a aprovação').toBe(200);

  externo = await criarUsuarioDeTeste(admin, prefixo, 'ext', 'Externo', 'EXTERNO', [equipeId]);
  interno = await criarUsuarioDeTeste(admin, prefixo, 'int', 'Interno', 'INTERNO', [equipeId]);
  gestor = await criarUsuarioDeTeste(admin, prefixo, 'ges', 'Gestor', 'GESTOR', [equipeId]);

  // Um relatório do EXTERNO, pendente na equipe (o contador do GESTOR mostra 1).
  const sigla = (await listar(admin, 'sigla', { tamanho: '1' })).itens[0].id;
  await criar(externo.token, ENTIDADE, {
    equipeId,
    projeto: await criar(admin, 'projeto', { equipeId, sigla, nome: `Projeto ${prefixo}` }),
    rtc: await criar(admin, 'rtc', { equipeId, rtc_externo_id: `RTC-${prefixo}` }),
    ambiente: await idPor(admin, 'ambiente', 'nome', 'Homologação'),
    status_resultado: await idPor(admin, 'status_resultado', 'descricao', 'Aprovado'),
    data_execucao: '2026-10-01T10:00:00-03:00',
    titulo: `${prefixo} pendente`,
    bateria_testes: 1,
    tipo_teste: 'API',
    executado_por: 'Equipe E2E',
  });
});

test.afterAll(async () => {
  await limparE2E(tokenDe('admin'));
});

/** Conta as requisições à fila e as respostas 403 da página, a partir de agora. */
function observarFila(pagina: Page): { requisicoes: () => number; proibidas: () => number } {
  let requisicoes = 0;
  let proibidas = 0;
  pagina.on('request', (r) => {
    if (r.url().includes(FILA)) {
      requisicoes++;
    }
  });
  pagina.on('response', (r) => {
    if (r.status() === 403) {
      proibidas++;
    }
  });
  return { requisicoes: () => requisicoes, proibidas: () => proibidas };
}

/** Três telas pelo menu: a listagem de Relatórios de Teste, Minha conta e o Início da área. */
async function navegarPorTresTelas(pagina: Page): Promise<void> {
  const menu = pagina.getByRole('navigation', { name: 'Menu da área de gestão' });
  await menu.getByRole('link', { name: 'Relatórios de Teste', exact: true }).click();
  await expect(pagina).toHaveURL(new RegExp(`/${GRUPO}/${ENTIDADE}`));
  await expect(pagina.getByRole('heading', { name: 'Relatórios de Teste', level: 1 })).toBeVisible();

  await noMenuDoUsuario(pagina, 'Minha conta');
  await expect(pagina.getByRole('heading', { name: 'Minha conta', level: 1 })).toBeVisible();

  await menu.getByRole('link', { name: 'Início', exact: true }).click();
  await expect(pagina).toHaveURL(new RegExp(`/${GRUPO}$`));
  // Tempo para um aviso tardio (o toast vem depois da resposta) aparecer, se houvesse.
  await pagina.waitForLoadState('networkidle');
}

async function semAvisos(pagina: Page): Promise<void> {
  await expect(pagina.locator('.p-toast-message')).toHaveCount(0);
  await expect(pagina.getByText('Você não tem permissão para esta operação.')).toHaveCount(0);
}

for (const [perfil, usuario] of [
  ['INTERNO', () => interno],
  ['EXTERNO', () => externo],
] as const) {
  test(`${perfil} navega por 3 telas sem nenhuma consulta à fila e sem nenhum aviso`, async ({ page }) => {
    const fila = observarFila(page);
    await entrarComToken(page, usuario().token, `/${GRUPO}`);
    await navegarPorTresTelas(page);

    await expect(page.getByRole('link', { name: /^Aprovações/ })).toHaveCount(0);
    await semAvisos(page);
    expect(fila.requisicoes(), 'requisições a /aprovacoes/pendentes').toBe(0);
    expect(fila.proibidas(), 'respostas 403').toBe(0);
  });
}

test('INTERNO entra na mesma aba depois do GESTOR: nenhuma consulta à fila e nenhum aviso', async ({ page }) => {
  await entrarComToken(page, gestor.token, `/${GRUPO}`);
  await expect(page.getByRole('link', { name: 'Aprovações (1 pendente)' })).toBeVisible();
  await noMenuDoUsuario(page, 'Sair');
  await expect(page).toHaveURL(/\/acesso/);

  // Daqui em diante, só o que o INTERNO faz (a página não recarrega: o app é o mesmo do GESTOR). Outro usuário do Windows
  // entra pelo "Entrar de novo".
  const fila = observarFila(page);
  await simularLoginWindows(page, interno.token);
  await page.getByRole('button', { name: 'Entrar de novo' }).click();
  await expect(botaoMenuUsuario(page)).toBeVisible();
  await navegarPorTresTelas(page);

  await expect(page.getByRole('link', { name: /^Aprovações/ })).toHaveCount(0);
  await semAvisos(page);
  expect(fila.requisicoes(), 'requisições a /aprovacoes/pendentes').toBe(0);
  expect(fila.proibidas(), 'respostas 403').toBe(0);
});

test('GESTOR vê o contador; navegar por 3 telas não consulta a fila de novo', async ({ page }) => {
  const fila = observarFila(page);
  await entrarComToken(page, gestor.token, `/${GRUPO}`);
  await expect(page.getByRole('link', { name: 'Aprovações (1 pendente)' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Na carga: o contador do cabeçalho e o da área (Início).
  const naCarga = fila.requisicoes();
  expect(naCarga).toBeGreaterThanOrEqual(1);
  expect(naCarga).toBeLessThanOrEqual(2);

  await navegarPorTresTelas(page);

  await expect(page.getByRole('link', { name: 'Aprovações (1 pendente)' })).toBeVisible();
  await semAvisos(page);
  expect(fila.requisicoes(), 'nenhuma consulta a mais ao navegar').toBe(naCarga);
});

test('GESTOR aprova direto na fila, sem abrir o item: aviso de sucesso e a fila e o contador zeram', async ({
  page,
}) => {
  await entrarComToken(page, gestor.token, `/aprovacoes?grupo=${GRUPO}`);
  const linha = page.locator('tbody tr').filter({ hasText: `${prefixo} pendente` });
  await expect(linha).toBeVisible();

  await linha.getByRole('button', { name: `Aprovar ${prefixo} pendente` }).click();
  const dialogo = page.getByRole('dialog', { name: 'Aprovar o item' });
  await expect(dialogo).toContainText(`${prefixo} pendente`);
  // A justificativa continua obrigatória (RN36): sem ela, o erro aparece no campo e nada é gravado.
  await dialogo.getByRole('button', { name: 'Aprovar' }).click();
  await expect(dialogo.locator('#justificativa-erro')).toBeVisible();
  await dialogo.getByRole('textbox', { name: /^Justificativa/ }).fill('Conferido direto na fila pelo teste.');
  await dialogo.getByRole('button', { name: 'Aprovar' }).click();

  await expect(dialogo).toBeHidden();
  await expect(page.getByText('Item aprovado.')).toBeVisible();
  // Continua na fila, já sem o item, e o contador do cabeçalho acompanha.
  await expect(page).toHaveURL(/\/aprovacoes/);
  await expect(page.getByText('Nenhum item aguardando aprovação')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Aprovações \(1 pendente\)/ })).toHaveCount(0);
});
