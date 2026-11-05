# Catalogo — front-end

Aplicação web do Catalogo em **Angular 20 + PrimeNG 20**. As telas são montadas a partir dos metadados da API
([`docs/frontend.md`](docs/frontend.md)). Regras para quem mexe no código: [`AGENTS.md`](AGENTS.md).

A API, o banco, as regras de negócio (`RNxx`) e o guia da API ficam no **repositório do back-end** (SDCAT-BACKEND). Os comandos
abaixo supõem um clone dele ao lado deste, em `../SDCAT-BACKEND`.

## Documentação

- [Como a tela se monta pelos metadados](docs/frontend.md)
- [Guia de interface](docs/design/guia-de-interface.md) e [revisão de usabilidade](docs/design/revisao-de-usabilidade.md)
- Guias do usuário: [criar uma área de gestão](docs/guias/criar-uma-listagem.md),
  [aprovação e avaliação](docs/guias/aprovacao-e-avaliacao.md), [importar planilhas](docs/guias/importar-planilhas.md)
- [Decisões de arquitetura do front (ADRs)](docs/adr/README.md)
- [Glossário](docs/glossario.md) (cópia; a fonte fica no back-end)

## Pré-requisitos

- **Node** `^20.19`, `^22.12` ou `^24` (exigência do Angular 20): `node --version`.
- **Banco e API do back-end no ar** (`backend/README.md` do repositório do back-end):

  ```bash
  (cd ../SDCAT-BACKEND/database/docker && docker compose --env-file ../.env up -d)
  (cd ../SDCAT-BACKEND/backend && dotnet run --project src/Catalogo.Api --launch-profile Development)
  ```

  A API sobe em `http://localhost:5080` (porta do perfil `Development` em `backend/src/Catalogo.Api/Properties/launchSettings.json`).
- Um **administrador** no banco. Se ainda não houver, crie com o comando `criar-admin` do back-end (sem senha: o login é o do
  Windows, ADR 0054):

  ```bash
  cd ../SDCAT-BACKEND/backend
  dotnet run --project src/Catalogo.Api --launch-profile Development -- criar-admin --matricula admin --nome "Administrador"
  ```

## Login pelo Windows

Não há tela de login: ao abrir, o front chama `POST /api/v1/auth/login` com `withCredentials` (o navegador manda o usuário do
Windows) e guarda o JWT. Se a API recusar ou não responder, a tela `/acesso` mostra "Acesso negado" ou "Catálogo indisponível", com
"Tentar de novo". No servidor, a URL da API precisa estar no `CORS_ALLOW` com a origem **exata** do front, e o site da API no IIS
com a Autenticação do Windows ligada (back-end, `docs/seguranca.md`).

No WSL/Linux não há Kerberos, então o login de verdade não funciona localmente com a API no Linux. Para usar a tela, gere um token do
banco local e cole no `sessionStorage` (chave `catalogo.token`), ou use os E2E:

```bash
node tools/token-local.mjs admin    # token de um usuário do banco local (SQL Server do Docker)
```

## Instalação e execução

```bash
npm install
npx playwright install chromium        # navegador dos testes (uma vez)
npm start                              # http://localhost:4200
```

O `npm start` sobe o servidor de desenvolvimento com o **proxy** `proxy.conf.json`, que encaminha `/api` para `http://localhost:5080`.
Localmente, o front chama caminhos relativos (`/api/v1/...`); se a API mudar de porta, mude só o `target` do proxy.

### URL da API no deploy (`BACK_API_URL`)

A URL da API é lida **no navegador**, antes de qualquer requisição, do arquivo `config.json` publicado na raiz do site
(`public/config.json` → **`dist/config.json`** no artefato do `npm run build`):

```json
{ "BACK_API_URL": "__BACK_API_URL__" }
```

O deploy substitui `__BACK_API_URL__` pela variável `BACK_API_URL`: a URL base da API, **sem** `/api/v1` (ex.:
`https://catalogo.api.cegti.df.caixa`; a barra no fim é ignorada). Esse é o único arquivo do build com o marcador; ele não tem hash
no nome e é lido sem cache. Com o marcador sem substituir (local) ou o arquivo ausente, o front usa caminhos relativos e o proxy.
Todas as chamadas (cliente gerado, login, exportações, importações) partem dessa URL (`ApiConfiguration.rootUrl`, definido em
`src/app/core/configuracao/configuracao-api.ts`). No back-end, o `CORS_ALLOW` precisa incluir a origem do front.

Configurações do front (tamanhos de página) ficam em `src/environments/environment.ts`. Não há listagem nem tela inicial fixas:
ao entrar, abre a última listagem usada (ou a primeira ativa), e a tela inicial dela vem dos metadados. **Listagens novas são criadas
pela interface** (Administração → Listagens; guia em [`docs/guias/criar-uma-listagem.md`](docs/guias/criar-uma-listagem.md)).

## Cliente da API

`src/app/api/` é **gerado** com o ng-openapi-gen a partir de `openapi/v1.json`, uma **cópia** do contrato do back-end
(`backend/openapi/v1.json` no repositório do back-end). Quando o contrato mudar, copie o arquivo e gere de novo:

```bash
cp ../SDCAT-BACKEND/backend/openapi/v1.json openapi/v1.json
npm run gerar-api
npm run build
```

Nunca edite `src/app/api/` nem `openapi/v1.json` à mão.

## Dados de exemplo

O banco local só tem os metadados. O script `tools/dados-dev/popular.mjs` cria, **pela API** (validações, `RegistroValor` e chaves
únicas valem), a Equipe Alfa e a Equipe Beta, um usuário de cada perfil (`dev.externo`, `dev.interno`, `dev.gestor`,
`dev.administrador`) e `dev.duas` (INTERNO nas duas equipes), os cadastros de apoio, projetos, endpoints e RTCs por equipe,
30 relatórios com cenários e links e, para o painel gerencial, 60 relatórios de histórico com execução espalhada de nov/2025 a
out/2026 (ambientes, status, tipos e medidas variados). É **idempotente**: rodar de novo não duplica nada, e nunca altera nem apaga
o que existe.

```bash
npm run dados-dev
```

| Variável | Para quê |
|---|---|
| `CATALOGO_ADMIN_MATRICULA` | matrícula do administrador (padrão `admin`) |
| `CATALOGO_API` | URL da API (padrão `http://localhost:5080`) |
| `CATALOGO_DB_CONTAINER`, `CATALOGO_DB` | container e banco locais de onde sai o token (padrão `listagem-generica-db` e `ListagemGenerica`) |

O script usa o token do administrador gerado com a chave do banco local (`tools/token-local.mjs`): não há senha.

## Testes

### Unitários

```bash
npm test
```

Karma + Jasmine (o executor padrão do `ng new` na v20), em modo headless, no Chromium do Playwright.

### E2E (Playwright)

Precisam do banco (Docker local), da API e dos dados de exemplo (`npm run dados-dev`):

```bash
npm run e2e
```

O login pelo Windows é **simulado**: o `POST /auth/login` responde, no navegador, com um JWT de verdade do banco local
(`e2e/apoio/sessao.ts` → `simularLoginWindows`, `tools/token-local.mjs`); o resto da API é o real.

O `npm run e2e` **compila o front** (`npm run build`) e o serve na porta **4300** (`scripts/servir-build.mjs`, com o mesmo proxy de
`/api` do `npm start`). Assim cada rodada testa exatamente o código atual. Variações:

| Comando | Quando usar |
|---|---|
| `npm run e2e` | o normal: build novo e servidor estático na 4300 |
| `E2E_SEM_BUILD=1 npx playwright test e2e/<arquivo>.spec.ts` | rodar de novo um arquivo sem ter mudado o front (reaproveita o `dist/`) |
| `npm run e2e:ng-serve` | durante o desenvolvimento, contra o `npm start` (4200), que o Playwright sobe se não estiver rodando |

Cada teste cria os próprios dados com um prefixo único (`E2E-...`). As capturas de tela ficam em `e2e/capturas/` e o relatório em
`playwright-report/`.

**`ng serve` no WSL:** o watcher às vezes perde alterações e continua servindo o código antigo (inclusive o aviso de erro de uma
compilação que já foi corrigida). Se acontecer, pare e suba de novo, ou use `npx ng serve --proxy-config proxy.conf.json --poll 2000`
(mais lento, mas confiável). É por isso que os E2E usam um build.

No Linux, o Chromium precisa de algumas bibliotecas do sistema; se ele não abrir (ex.: `libnspr4.so: cannot open shared object
file`), instale-as uma vez com `sudo npx playwright install-deps chromium`.

## Lint e formatação

```bash
npm run lint
npm run format
```
