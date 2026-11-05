import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Rotas que exigem sessão (todas, menos a tela de acesso). Sem sessão: a tela de acesso, que entra pelo Windows. */
export const autenticadoGuard: CanActivateFn = (_rota, estado) => {
  const auth = inject(AuthService);
  if (auth.logado()) {
    return true;
  }
  return inject(Router).createUrlTree(['/acesso'], { queryParams: { returnUrl: estado.url } });
};

/** A tela de acesso para quem já está logado leva à tela inicial. */
export const anonimoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.logado() ? inject(Router).createUrlTree(['/']) : true;
};
