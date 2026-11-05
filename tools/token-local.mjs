// Token (JWT) de um usuário do banco LOCAL, para os E2E e o npm run dados-dev, que rodam sem Windows: no computador do
// desenvolvedor (WSL, Linux) não há a autenticação integrada que o POST /auth/login exige (RN23, ADR 0054). O token é o MESMO
// que a API emite (emissor, audiência, claims e a chave do banco local, cat.CATTB025_CHAVE_JWT), então o resto da API o aceita.
//
// SÓ para o SQL Server LOCAL em Docker (database/docker): lê a chave e o usuário com o sa do próprio container, que já tem a senha
// dele (MSSQL_SA_PASSWORD). Nunca aponte para um banco de servidor.
//
//   node tools/token-local.mjs admin        # imprime o token do usuário "admin" (cole em sessionStorage "catalogo.token")
//
// Variáveis (opcionais): CATALOGO_DB_CONTAINER (padrão listagem-generica-db) e CATALOGO_DB (padrão ListagemGenerica).

import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { basename } from 'node:path';

const CONTAINER = process.env.CATALOGO_DB_CONTAINER ?? 'listagem-generica-db';
const BANCO = process.env.CATALOGO_DB ?? 'ListagemGenerica';
// Os mesmos do appsettings.json da API (seção "Jwt").
const EMISSOR = 'catalogo-api';
const AUDIENCIA = 'catalogo';
const VALIDADE_SEGUNDOS = 8 * 60 * 60;

let chave;

function consultar(sql) {
  const comando =
    `/opt/mssql-tools18/bin/sqlcmd -C -b -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d ${BANCO} -h -1 -W -s "|" ` +
    `-Q "SET NOCOUNT ON; ${sql}"`;
  return execFileSync('docker', ['exec', CONTAINER, 'bash', '-c', comando], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);
}

function base64url(texto) {
  return Buffer.from(texto).toString('base64url');
}

/**
 * O token de acesso do usuário com essa matrícula, como a API o devolveria no login: { token, expiraEm, usuario }.
 * Falha se a matrícula não existir no banco local (crie com o criar-admin, o npm run dados-dev ou pela tela de Usuários).
 */
export function tokenLocal(matricula) {
  if (!/^[A-Za-z0-9._-]{1,20}$/.test(matricula)) {
    throw new Error(`Matrícula inválida: "${matricula}".`);
  }
  chave ??= consultar('SELECT TOP (1) CO_CHAVE_JWT FROM cat.CATTB025_CHAVE_JWT')[0];
  if (!chave) {
    throw new Error(
      'Sem chave do JWT no banco local (cat.CATTB025_CHAVE_JWT): suba a API uma vez para ela gerar a chave.',
    );
  }
  const [linha] = consultar(
    `SELECT CAST(NU_NSU_USUARIO AS varchar(36)), CO_MATRICULA, NO_PERFIL FROM cat.CATTB008_USUARIO WHERE CO_MATRICULA = '${matricula}'`,
  );
  if (!linha) {
    throw new Error(`Usuário "${matricula}" não existe no banco local. Rodou o criar-admin e o npm run dados-dev?`);
  }
  const [id, matriculaBanco, perfil] = linha.split('|');

  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = base64url(
    JSON.stringify({
      sub: id.toLowerCase(),
      matricula: matriculaBanco,
      perfil,
      iss: EMISSOR,
      aud: AUDIENCIA,
      iat: agora,
      nbf: agora,
      exp: agora + VALIDADE_SEGUNDOS,
    }),
  );
  const assinatura = createHmac('sha256', Buffer.from(chave, 'utf8'))
    .update(`${cabecalho}.${corpo}`)
    .digest('base64url');
  return {
    token: `${cabecalho}.${corpo}.${assinatura}`,
    expiraEm: new Date((agora + VALIDADE_SEGUNDOS) * 1000).toISOString(),
    usuario: { id: id.toLowerCase(), matricula: matriculaBanco, perfil },
  };
}

// Linha de comando (sem import.meta: os E2E carregam este arquivo transpilado para CommonJS).
if (basename(process.argv[1] ?? '') === 'token-local.mjs') {
  const matricula = process.argv[2];
  if (!matricula) {
    console.error('Uso: node tools/token-local.mjs <matrícula>');
    process.exit(1);
  }
  console.log(tokenLocal(matricula).token);
}
