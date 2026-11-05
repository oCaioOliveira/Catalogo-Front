import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const URL_LOGIN = '/api/v1/auth/login';

/**
 * Autenticação de toda chamada à API:
 *   - o login (POST /auth/login) vai com `withCredentials`: é o navegador que manda o usuário do Windows (RN23, ADR 0054);
 *   - as demais levam `Authorization: Bearer <token>`;
 *   - 401 (token expirado ou usuário desativado): limpa a sessão e vai para a tela de acesso, que entra de novo pelo Windows e
 *     volta para a tela em que a pessoa estava (returnUrl).
 * O erro do próprio login não é sessão expirada: fica para o AuthService, que mostra acesso negado ou indisponível.
 */
export const authInterceptor: HttpInterceptorFn = (requisicao, proximo) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ehLogin = requisicao.url.endsWith(URL_LOGIN);
  const token = auth.token();
  const preparada = ehLogin
    ? requisicao.clone({ withCredentials: true })
    : token
      ? requisicao.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : requisicao;

  return proximo(preparada).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && !ehLogin && erro.status === 401) {
        auth.limparSessao();
        const atual = router.url.startsWith('/acesso') ? undefined : router.url;
        void router.navigate(['/acesso'], { queryParams: atual ? { returnUrl: atual } : {} });
      }
      return throwError(() => erro);
    }),
  );
};
