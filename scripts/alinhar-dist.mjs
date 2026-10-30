import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(process.cwd(), 'dist');
const browser = join(raiz, 'browser');

if (!existsSync(browser)) {
  process.exit(0);
}

for (const item of readdirSync(browser, { withFileTypes: true })) {
  const origem = join(browser, item.name);
  const destino = join(raiz, item.name);

  if (existsSync(destino)) {
    rmSync(destino, { recursive: true, force: true });
  }

  renameSync(origem, destino);
}

rmSync(browser, { recursive: true, force: true });
console.log(`Arquivos do build movidos para a raiz de ${raiz}.`);
