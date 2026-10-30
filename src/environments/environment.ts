/**
 * Configurações do front num lugar só. A URL da API NÃO fica aqui (este arquivo entra compilado no build): ela vem do
 * `config.json` (BACK_API_URL), lido no navegador antes de qualquer requisição (core/configuracao/configuracao-api.ts). Sem ela
 * (local), a API é chamada por caminhos relativos (/api/v1/...) e o `npm start` encaminha /api pelo proxy (proxy.conf.json).
 */
export const environment = {
  // Não há listagem nem entidade fixas: a tela inicial vem dos metadados (ADR 0043).

  /** Itens por página das listagens (a API aceita de 1 a 100). */
  tamanhoPagina: 20,

  /** Opções de itens por página mostradas na tabela. */
  opcoesTamanhoPagina: [10, 20, 50, 100],

  /** Quantas opções o select de referência busca por vez. */
  tamanhoPaginaOpcoes: 20,
};
