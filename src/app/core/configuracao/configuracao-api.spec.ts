import { carregarUrlApi, normalizarUrlApi } from './configuracao-api';

describe('configuracao-api (BACK_API_URL)', () => {
  it('tira espaços e as barras do fim', () => {
    expect(normalizarUrlApi(' https://catalogo.api.cegti.df.caixa/ ')).toBe('https://catalogo.api.cegti.df.caixa');
    expect(normalizarUrlApi('https://catalogo.api.cegti.df.caixa//')).toBe('https://catalogo.api.cegti.df.caixa');
    expect(normalizarUrlApi('http://localhost:5080')).toBe('http://localhost:5080');
  });

  it('marcador não substituído, vazio ou ausente: caminhos relativos (proxy do desenvolvimento)', () => {
    expect(normalizarUrlApi('__BACK_API_URL__')).toBe('');
    expect(normalizarUrlApi('')).toBe('');
    expect(normalizarUrlApi(undefined)).toBe('');
    expect(normalizarUrlApi(42)).toBe('');
  });

  it('valor que não é uma URL http(s) completa: caminhos relativos e aviso no console', () => {
    const erro = spyOn(console, 'error');

    expect(normalizarUrlApi('catalogo.api.cegti.df.caixa')).toBe('');
    expect(erro).toHaveBeenCalled();
  });

  it('lê o config.json sem cache e devolve a URL normalizada', async () => {
    const buscar = jasmine
      .createSpy('fetch')
      .and.resolveTo(new Response('{ "BACK_API_URL": "https://catalogo.api.cegti.df.caixa/" }', { status: 200 }));

    expect(await carregarUrlApi(buscar)).toBe('https://catalogo.api.cegti.df.caixa');
    const [endereco, opcoes] = buscar.calls.mostRecent().args;
    expect(String(endereco)).toMatch(/\/config\.json$/);
    expect(opcoes).toEqual(jasmine.objectContaining({ cache: 'no-store' }));
  });

  it('config.json ausente ou inválido: caminhos relativos', async () => {
    expect(await carregarUrlApi(jasmine.createSpy('fetch').and.resolveTo(new Response('', { status: 404 })))).toBe('');
    expect(
      await carregarUrlApi(jasmine.createSpy('fetch').and.resolveTo(new Response('não é json', { status: 200 }))),
    ).toBe('');
    expect(await carregarUrlApi(jasmine.createSpy('fetch').and.rejectWith(new TypeError('rede')))).toBe('');
  });
});
