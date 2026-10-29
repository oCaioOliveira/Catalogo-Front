import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Status HTTP que o PRÓPRIO componente vai tratar (ex.: o formulário trata 400 e 409 mostrando os erros nos
 * campos). Para esses, o interceptor de erros não mostra o toast genérico.
 */
export const STATUS_TRATADOS_PELO_COMPONENTE = new HttpContextToken<readonly number[]>(() => []);

export function tratarNoComponente(...status: number[]): HttpContext {
  return new HttpContext().set(STATUS_TRATADOS_PELO_COMPONENTE, status);
}

/**
 * Requisição de FUNDO (contadores, badges): se falhar, falha em silêncio, sem toast. Quem chama decide o que mostrar (em geral, nada).
 */
export const ERRO_SILENCIOSO = new HttpContextToken<boolean>(() => false);

export function silencioso(): HttpContext {
  return new HttpContext().set(ERRO_SILENCIOSO, true);
}
