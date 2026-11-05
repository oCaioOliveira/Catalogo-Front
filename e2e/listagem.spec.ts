import { expect, test } from '@playwright/test';
import { cadastrosAlfa, criar, criarRelatorio, idPor, prefixoUnico, tokenDe } from './apoio/api';
import { campo, capturar, digitarData, entrarComo, escolherReferencia } from './apoio/sessao';

// RN17 a RN19: filtros, ordenação e paginação pela API, com o estado na URL (ADR 0037).
test('filtra por intervalo de data e por projeto, ordena por número e guarda tudo na URL', async ({ page }) => {
  const gestor = tokenDe('dev.gestor');
  const c = await cadastrosAlfa(tokenDe('admin'));
  const prefixo = prefixoUnico();
  const esperado = await criarRelatorio(gestor, `${prefixo} A`, {
    projeto: c.outroProjeto,
    data_execucao: '2026-09-10T10:00:00-03:00',
  });
  await criarRelatorio(gestor, `${prefixo} B`, { projeto: c.projeto, data_execucao: '2026-09-12T10:00:00-03:00' });
  await criarRelatorio(gestor, `${prefixo} C`, { projeto: c.outroProjeto, data_execucao: '2026-08-01T10:00:00-03:00' });

  await entrarComo(page, 'dev.gestor', '/testes_desempenho/relatorio_teste');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await campo(page, 'Título (contém)').fill(prefixo);
  await digitarData(page, 'Data de execução: de', '01/09/2026');
  await digitarData(page, 'Data de execução: até', '30/09/2026');
  await escolherReferencia(page, /^Projeto$/, 'Consultas', 'Consultas Alfa');
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();

  await expect(page).toHaveURL(/data_execucao\.de=2026-09-01/);
  await expect(page).toHaveURL(/data_execucao\.ate=2026-09-30/);
  await expect(page).toHaveURL(new RegExp(`projeto=${c.outroProjeto}`));
  const linhas = page.locator('tbody tr');
  await expect(linhas).toHaveCount(1);
  await expect(linhas.first()).toContainText(`${prefixo} A`);
  await capturar(page, '02-listagem-com-filtros');

  // Recarregar mantém a mesma consulta (o estado está na URL).
  await page.reload();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText(`${prefixo} A`);
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await expect(campo(page, 'Data de execução: de')).toHaveValue('01/09/2026');
  await expect(campo(page, /^Projeto$/)).toHaveValue('Consultas Alfa');

  // Ordenação por uma coluna numérica (entre as colunas padrão): os cenários do relatório, pelo tempo médio de resposta.
  const endpoint = await idPor(gestor, 'endpoint_servico', 'nome_servico', 'enviar-consultas-alfa');
  for (const [numero, tempo] of [
    [1, 300],
    [2, 100],
    [3, 200],
  ]) {
    await criar(gestor, 'cenario_teste', {
      equipeId: c.equipe,
      relatorio_teste: esperado,
      endpoint_servico: endpoint,
      numero_cenario: numero,
      usuarios_virtuais: 100,
      tempo_medio_resposta_ms: tempo,
      percentil_95_ms: 400,
      vazao_media_tps: 10,
      taxa_erro_percentual: 1,
    });
  }
  await page.goto(`/testes_desempenho/cenario_teste?relatorio_teste=${esperado}`);
  const coluna = page.getByRole('columnheader', { name: /^Tempo médio/ });
  await coluna.click();
  await expect(page).toHaveURL(/ordenacao=tempo_medio_resposta_ms/);
  const indice = await page
    .locator('thead th')
    .evaluateAll((ths) => ths.findIndex((th) => th.textContent?.trim().startsWith('Tempo médio')));
  const valores = page.locator(`tbody tr td:nth-child(${indice + 1})`);
  await expect(valores).toHaveText(['100,00', '200,00', '300,00']);
  await coluna.click();
  await expect(page).toHaveURL(/ordenacao=-tempo_medio_resposta_ms/);
  await expect(valores).toHaveText(['300,00', '200,00', '100,00']);
});
