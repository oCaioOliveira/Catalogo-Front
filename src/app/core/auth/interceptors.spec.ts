import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { silencioso, tratarNoComponente } from '../erros/contexto-erros';
import { erroInterceptor } from '../erros/erro.interceptor';
import { URL_LOGIN, authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('interceptors de autenticação e de erros', () => {
  let http: HttpClient;
  let controle: HttpTestingController;
  let router: Router;
  let auth: AuthService;
  let mensagens: MessageService;

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
    http = TestBed.inject(HttpClient);
    controle = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    mensagens = TestBed.inject(MessageService);
    auth.token.set('token-123');
    auth.usuario.set({ id: 'u', matricula: 'm', nome: 'n', perfil: 'INTERNO', equipes: [] });
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(mensagens, 'add');
  });

  afterEach(() => controle.verify());

  async function chamarComErro(
    status: number,
    corpo: object,
    url = '/api/v1/grupos',
    contexto = tratarNoComponente(),
  ): Promise<void> {
    const pedido = firstValueFrom(http.get(url, { context: contexto }));
    controle.expectOne(url).flush(corpo, { status, statusText: 'x' });
    await expectAsync(pedido).toBeRejected();
  }

  it('envia o token no cabeçalho Authorization', () => {
    http.get('/api/v1/grupos').subscribe();
    const requisicao = controle.expectOne('/api/v1/grupos');
    expect(requisicao.request.headers.get('Authorization')).toBe('Bearer token-123');
    requisicao.flush([]);
  });

  it('o login vai com as credenciais do Windows (withCredentials) e sem o token', () => {
    http.post(URL_LOGIN, null).subscribe();
    const requisicao = controle.expectOne(URL_LOGIN);
    expect(requisicao.request.withCredentials).toBeTrue();
    expect(requisicao.request.headers.has('Authorization')).toBeFalse();
    expect(requisicao.request.body).toBeNull();
    requisicao.flush({ token: 't' });
  });

  it('as demais chamadas não mandam credenciais', () => {
    http.get('/api/v1/grupos').subscribe();
    const requisicao = controle.expectOne('/api/v1/grupos');
    expect(requisicao.request.withCredentials).toBeFalse();
    requisicao.flush([]);
  });

  it('401: limpa a sessão e vai para a tela de acesso com o returnUrl, sem toast', async () => {
    await chamarComErro(401, { codigo: 'NAO_AUTENTICADO' });
    expect(auth.token()).toBeNull();
    expect(auth.usuario()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/acesso'],
      jasmine.objectContaining({ queryParams: jasmine.any(Object) }),
    );
    expect(mensagens.add).not.toHaveBeenCalled();
  });

  it('401 do próprio login não é sessão expirada: quem trata é o AuthService', async () => {
    const pedido = firstValueFrom(http.post(URL_LOGIN, null, { context: silencioso() }));
    controle.expectOne(URL_LOGIN).flush({ codigo: 'NAO_AUTENTICADO' }, { status: 401, statusText: 'x' });
    await expectAsync(pedido).toBeRejected();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(auth.token()).toBe('token-123');
  });

  it('outros erros viram toast; 5xx mostra o traceId', async () => {
    await chamarComErro(500, { codigo: 'ERRO_INTERNO', traceId: 'trace-1' });
    expect(mensagens.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', detail: 'Código para o suporte: trace-1' }),
    );
  });

  it('status tratado pelo componente não vira toast', async () => {
    await chamarComErro(400, { codigo: 'VALIDACAO', errors: {} }, '/api/v1/grupos', tratarNoComponente(400));
    expect(mensagens.add).not.toHaveBeenCalled();
  });

  it('requisição de fundo (silencioso) falha sem toast, qualquer que seja o status', async () => {
    await chamarComErro(403, { codigo: 'SEM_PERMISSAO' }, '/api/v1/aprovacoes/pendentes', silencioso());
    await chamarComErro(500, { codigo: 'ERRO_INTERNO', traceId: 't' }, '/api/v1/aprovacoes/pendentes', silencioso());
    expect(mensagens.add).not.toHaveBeenCalled();
  });

  it('requisição de fundo com 401 ainda leva à tela de acesso', async () => {
    await chamarComErro(401, { codigo: 'NAO_AUTENTICADO' }, '/api/v1/aprovacoes/pendentes', silencioso());
    expect(auth.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalled();
  });
});
