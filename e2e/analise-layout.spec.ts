import { Page, expect, test } from '@playwright/test';
import { capturar, entrarComo } from './apoio/sessao';

/**
 * Layout do card de configuração da análise personalizada: nenhum elemento passa da borda do card (o bug: o <fieldset> das
 * dimensões não encolhia abaixo do conteúdo, e a linha do título "Dimensões (até 2)" e os botões de remover vazavam pela direita).
 * Confere três análises do painel, os temas claro e escuro e a largura de celular. Capturas em e2e/capturas/analise-layout-*.png.
 */

const PAINEL = '/painel/testes_desempenho';
const ANALISES = [
  'Relatórios executados por mês e status',
  'Vazão média (TPS) por ambiente',
  'Relatórios por tecnologia',
];
const LARGURAS = [
  { nome: 'desktop', width: 1400, height: 900 },
  { nome: 'celular', width: 375, height: 812 },
];

/**
 * Os elementos visíveis do card que passam da borda (esquerda ou direita, com meio pixel de folga). Os textos de leitor de tela
 * (`sr-only`, `p-hidden-accessible`) ficam de fora: são recortados de propósito.
 */
async function foraDoCard(pagina: Page): Promise<string[]> {
  return pagina.locator('form.painel-analise').evaluate((card) => {
    const borda = card.getBoundingClientRect();
    const fora: string[] = [];
    if (card.scrollWidth > card.clientWidth + 0.5) {
      fora.push(`o card rola na horizontal (${card.scrollWidth} > ${card.clientWidth})`);
    }
    for (const el of Array.from(card.querySelectorAll<HTMLElement>('*'))) {
      if (el.closest('.sr-only, .p-hidden-accessible')) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        continue;
      }
      if (r.right > borda.right + 0.5 || r.left < borda.left - 0.5) {
        const nome = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '';
        fora.push(
          `${el.tagName.toLowerCase()}.${el.className} "${nome}": ${Math.round(r.left)}–${Math.round(r.right)}`,
        );
      }
    }
    return fora;
  });
}

for (const tema of ['claro', 'escuro'] as const) {
  test(`análise personalizada, tema ${tema}: nenhum elemento do card de configuração passa da borda`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem('catalogo.tema', t), tema);
    for (const titulo of ANALISES) {
      await page.setViewportSize(LARGURAS[0]);
      await entrarComo(page, 'dev.gestor', PAINEL);
      await page.getByRole('link', { name: `Abrir na análise: ${titulo}` }).click();
      const card = page.getByRole('form', { name: 'Configuração da análise' });
      await expect(card.getByRole('group', { name: /^Dimensões \(até 2\)/ })).toBeVisible();
      await expect(card.getByRole('combobox', { name: 'Dimensão 1' })).toBeVisible();
      for (const largura of LARGURAS) {
        await page.setViewportSize(largura);
        await expect.poll(() => foraDoCard(page), { message: `${titulo}, ${largura.nome}` }).toEqual([]);
      }
      if (titulo === ANALISES[0]) {
        // A análise do bug: duas dimensões, a primeira de data (com "Agrupar por") e um botão de remover em cada linha.
        await expect(card.getByRole('combobox', { name: 'Agrupar por' })).toBeVisible();
        await expect(card.getByRole('combobox', { name: 'Dimensão 2' })).toBeVisible();
        await card.scrollIntoViewIfNeeded();
        await capturar(page, `analise-layout-${tema}-celular`);
        await page.setViewportSize(LARGURAS[0]);
        await capturar(page, `analise-layout-${tema}-desktop`);
      }
    }
  });
}
