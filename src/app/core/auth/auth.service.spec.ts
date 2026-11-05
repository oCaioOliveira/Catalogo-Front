import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { erroInterceptor } from '../erros/erro.interceptor';
import { URL_LOGIN, authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

// RN23 (login pelo Windows, ADR 0054): não há tela de login; o front entra sozinho e guarda o JWT.
describe('AuthService (login pelo Windows)', () => {
  let auth: AuthService;
  let controle: HttpTestingController;
  let mensagens: MessageService;

  const usuarioDto = {
    id: 'u1',
    matricula: 'C161587',
    nome: 'Fulana',
    perfil: 'EXTERNO',
    equipes: [],
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
    auth = TestBed.inject(AuthService);
    controle = TestBed.inject(HttpTestingController);
    mensagens = TestBed.inject(MessageService);
    spyOn(mensagens, 'add');
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => controle.verify());

  async function responderLogin(status: number, corpo: object = {}): Promise<void> {
    // O invoke do cliente gerado é assíncrono: espera a requisição sair.
    await new Promise((r) => setTimeout(r));
    const pedido = controle.expectOne((r) => r.url.endsWith(URL_LOGIN));
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.withCredentials).toBeTrue();
    pedido.flush(corpo, { status, statusText: 'x' });
  }

  it('iniciar: entra pelo Windows, guarda o token e carrega o usuário', async () => {
    const iniciando = auth.iniciar();
    await responderLogin(200, { token: 'jwt-1', expiraEm: '2026-11-05T20:00:00Z', usuario: usuarioDto });
    await new Promise((r) => setTimeout(r));
    controle.expectOne((r) => r.url.endsWith('/api/v1/auth/eu')).flush(usuarioDto);
    await iniciando;

    expect(auth.token()).toBe('jwt-1');
    expect(sessionStorage.getItem('catalogo.token')).toBe('jwt-1');
    expect(auth.usuario()?.matricula).toBe('C161587');
    expect(auth.logado()).toBeTrue();
    expect(auth.falha()).toBeNull();
  });

  it('401 ou 403 do login: acesso negado, sem token e sem toast', async () => {
    for (const status of [401, 403]) {
      const entrando = auth.entrar();
      await responderLogin(status, { codigo: status === 401 ? 'NAO_AUTENTICADO' : 'SEM_PERMISSAO' });
      expect(await entrando).toBeFalse();
      expect(auth.falha()).toBe('negado');
      expect(auth.token()).toBeNull();
    }
    expect(mensagens.add).not.toHaveBeenCalled();
  });

  it('API fora do ar ou com erro: indisponível', async () => {
    const entrando = auth.entrar();
    await responderLogin(500, { codigo: 'ERRO_INTERNO' });
    expect(await entrando).toBeFalse();
    expect(auth.falha()).toBe('indisponivel');
    expect(auth.logado()).toBeFalse();
  });

  it('sair: esquece a sessão e não entra de novo sozinho', () => {
    auth.token.set('jwt-1');
    auth.sair();
    expect(auth.token()).toBeNull();
    expect(auth.falha()).toBe('saiu');
    controle.expectNone((r) => r.url.endsWith(URL_LOGIN));
  });
});
