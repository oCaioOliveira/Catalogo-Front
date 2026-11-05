import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chamar, gravarTokens, tokenDaMatricula, UsuarioDev } from './api';
import { limparE2E } from './limpeza';

/**
 * Antes de todos os testes: um token de cada usuário de exemplo (tools/token-local.mjs, com a chave do banco local), guardado em
 * e2e/.estado/ (fora do git). Os testes entram simulando o login pelo Windows com esse token (sessao.ts). Tokens ainda válidos
 * (8 h) de uma execução anterior são reaproveitados.
 */
export default async function preparar(): Promise<void> {
  const arquivo = join(__dirname, '..', '.estado', 'tokens.json');
  const anteriores: Record<string, string> = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {};

  const usuarios: UsuarioDev[] = ['admin', 'dev.externo', 'dev.interno', 'dev.gestor'];
  const tokens: Record<string, string> = {};
  for (const usuario of usuarios) {
    const anterior = anteriores[usuario];
    const valido = anterior ? (await chamar(anterior, 'GET', '/auth/eu')).status === 200 : false;
    tokens[usuario] = valido ? anterior : tokenDaMatricula(usuario);
  }
  gravarTokens(tokens);
  // Sobras de execuções interrompidas: listagens de teste ATIVAS (mudariam a tela inicial dos outros testes, que é a primeira
  // listagem por nome), equipes e usuários de teste. Cada suíte que cria equipes ou usuários também limpa no início e no fim.
  await limparE2E(tokens['admin']);
}
