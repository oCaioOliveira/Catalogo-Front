/**
 * URL da API lida NO NAVEGADOR, antes de qualquer requisição, do `config.json` publicado na raiz do site (`public/config.json`):
 *   { "BACK_API_URL": "__BACK_API_URL__" }
 * O deploy da CAIXA substitui o marcador pela variável BACK_API_URL (ex.: https://catalogo.api.cegti.df.caixa) no arquivo do
 * artefato (`dist/config.json`). O mesmo build serve para todos os ambientes.
 *
 * Marcador não substituído (local), arquivo ausente ou valor vazio: URL vazia, ou seja, caminhos relativos (/api/v1/...), que o
 * `npm start` leva para a API local pelo proxy (proxy.conf.json).
 */

/** Caminho do arquivo, relativo ao `<base href>`. Sem hash no nome: o deploy precisa achá-lo e trocar o marcador. */
export const ARQUIVO_CONFIGURACAO = 'config.json';

const MARCADOR = /^__.*__$/;

/**
 * Normaliza o BACK_API_URL: sem espaços e sem barra no fim. Marcador não substituído, vazio ou algo que não é uma URL http(s)
 * completa viram "" (caminhos relativos); o último caso também avisa no console, porque o deploy foi feito com um valor errado.
 */
export function normalizarUrlApi(valor: unknown): string {
  if (typeof valor !== 'string') {
    return '';
  }
  const url = valor.trim();
  if (url === '' || MARCADOR.test(url)) {
    return '';
  }
  if (!/^https?:\/\/[^/\s]+/i.test(url)) {
    console.error(
      `BACK_API_URL inválido em ${ARQUIVO_CONFIGURACAO}: "${url}". Use a URL completa da API (https://...).`,
    );
    return '';
  }
  return url.replace(/\/+$/, '');
}

/** Lê o `config.json` sem cache (o deploy troca o conteúdo sem trocar o nome) e devolve a URL da API normalizada. */
export async function carregarUrlApi(
  buscar: typeof fetch = (entrada, opcoes) => fetch(entrada, opcoes),
): Promise<string> {
  try {
    const resposta = await buscar(new URL(ARQUIVO_CONFIGURACAO, document.baseURI).href, { cache: 'no-store' });
    if (!resposta.ok) {
      return '';
    }
    const configuracao: unknown = await resposta.json();
    return normalizarUrlApi((configuracao as { BACK_API_URL?: unknown } | null)?.BACK_API_URL);
  } catch {
    // Sem o arquivo ou com JSON inválido: caminhos relativos, como no desenvolvimento.
    return '';
  }
}
