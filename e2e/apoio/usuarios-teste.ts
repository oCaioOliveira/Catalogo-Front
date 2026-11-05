import { Browser, Page, expect } from '@playwright/test';
import { chamar, tokenDaMatricula } from './api';
import { entrarComToken } from './sessao';

/**
 * Usuários criados pelo próprio teste (matrícula "e2e-…", desativados pelo helper de limpeza, e2e/apoio/limpeza.ts). Não há senha:
 * o token é o que o login pelo Windows daria a essa matrícula (api.ts → tokenDaMatricula).
 */
export interface UsuarioTeste {
  id: string;
  matricula: string;
  token: string;
}

/** Cria o usuário nas equipes, pela matrícula (como o administrador faz na tela), e devolve o token dele. */
export async function criarUsuarioDeTeste(
  admin: string,
  prefixo: string,
  sufixo: string,
  nome: string,
  perfil: string,
  equipes: string[],
): Promise<UsuarioTeste> {
  const matricula = `${prefixo.toLowerCase()}-${sufixo}`;
  const { status, corpo } = await chamar<{ id: string }>(admin, 'POST', '/usuarios', {
    matricula,
    nome: `${nome} ${prefixo}`,
    perfil,
    equipes,
  });
  expect(status, `POST /usuarios ${perfil}`).toBe(201);
  return { id: corpo.id, matricula, token: tokenDaMatricula(matricula) };
}

/** Uma página nova (outro contexto: outra sessão, sem o localStorage das outras) já logada com o token. */
export async function abrirComo(browser: Browser, token: string, caminho: string): Promise<Page> {
  const contexto = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1400, height: 900 },
    reducedMotion: 'reduce',
  });
  const pagina = await contexto.newPage();
  await entrarComToken(pagina, token, caminho);
  return pagina;
}
