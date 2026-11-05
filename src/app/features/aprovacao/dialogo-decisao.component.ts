import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { AprovacaoService } from '../../core/aprovacao/aprovacao.service';
import { PendentesService } from '../../core/aprovacao/pendentes.service';
import { JUSTIFICATIVA, validarJustificativa } from '../../core/aprovacao/regras-aprovacao';
import { tratarNoComponente } from '../../core/erros/contexto-erros';
import { mensagemDoErro } from '../../core/erros/mensagens-erro';
import { lerProblema } from '../../core/erros/problema';
import { Registro } from '../../core/registros/modelo-registro';

export type Decisao = 'APROVAR' | 'REJEITAR';

/** O item a decidir: onde ele está e como se chama (o rótulo aparece no diálogo, para não decidir o item errado). */
export interface AlvoDecisao {
  grupo: string;
  entidade: string;
  id: string;
  rotulo: string | null;
}

/**
 * O diálogo de Aprovar ou Rejeitar um item pendente (RN35 a RN37), o MESMO na faixa do detalhe e na fila de aprovações: a
 * justificativa é obrigatória (10 a 1000 caracteres, com contador), os erros aparecem no campo e, ao gravar, um aviso de sucesso
 * confirma a decisão e o contador de pendentes do cabeçalho é atualizado. Quem decide é a API; aqui só se mostra o que ela disser.
 */
@Component({
  selector: 'app-dialogo-decisao',
  imports: [FormsModule, Button, Dialog, Message, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="decisao() === 'APROVAR' ? 'Aprovar o item' : 'Rejeitar o item'"
      [modal]="true"
      [visible]="!!decisao()"
      [draggable]="false"
      [style]="{ width: 'min(36rem, 95vw)' }"
      styleClass="dialogo-decisao"
      (visibleChange)="$event ? null : fechar()"
    >
      <form (submit)="$event.preventDefault(); decidir()" novalidate>
        @if (erroGeral()) {
          <p-message severity="error" styleClass="mb-3">{{ erroGeral() }}</p-message>
        }
        @if (alvo()?.rotulo; as rotulo) {
          <p class="alvo-decisao">
            <strong>{{ rotulo }}</strong>
          </p>
        }
        <p>
          {{
            decisao() === 'APROVAR'
              ? 'O item passa a valer para todos. Explique o que foi conferido.'
              : 'O autor recebe o item de volta para corrigir e reenviar. Explique o que precisa mudar.'
          }}
        </p>
        <div class="campo">
          <label for="justificativa" class="campo-rotulo">
            Justificativa <span class="obrigatorio" aria-hidden="true">*</span
            ><span class="sr-only">(obrigatório)</span>
          </label>
          <textarea
            pTextarea
            id="justificativa"
            name="justificativa"
            rows="4"
            class="w-full"
            [attr.maxlength]="limites.maximo"
            [attr.aria-invalid]="!!erroJustificativa()"
            [attr.aria-describedby]="
              erroJustificativa() ? 'justificativa-contador justificativa-erro' : 'justificativa-contador'
            "
            [ngModel]="justificativa()"
            (ngModelChange)="justificativa.set($event); erroJustificativa.set(null)"
          ></textarea>
          <small class="contador" id="justificativa-contador">
            {{ tamanho() }}/{{ limites.maximo }} (mínimo {{ limites.minimo }})
          </small>
          @if (erroJustificativa()) {
            <small class="campo-erros" id="justificativa-erro">{{ erroJustificativa() }}</small>
          }
        </div>
        <div class="acoes-formulario">
          <p-button type="button" label="Cancelar" severity="secondary" [text]="true" (onClick)="fechar()" />
          <p-button
            type="submit"
            [label]="decisao() === 'APROVAR' ? 'Aprovar' : 'Rejeitar'"
            [icon]="decisao() === 'APROVAR' ? 'pi pi-check' : 'pi pi-times'"
            [severity]="decisao() === 'APROVAR' ? 'success' : 'danger'"
            [loading]="decidindo()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class DialogoDecisaoComponent {
  /** A decisão foi gravada: o registro atualizado (situação, versão e última decisão novas). */
  readonly decidido = output<Registro>();

  private readonly aprovacao = inject(AprovacaoService);
  private readonly pendentes = inject(PendentesService);
  private readonly mensagens = inject(MessageService);

  readonly limites = JUSTIFICATIVA;
  readonly alvo = signal<AlvoDecisao | null>(null);
  readonly decisao = signal<Decisao | null>(null);
  readonly justificativa = signal('');
  readonly erroJustificativa = signal<string | null>(null);
  readonly erroGeral = signal<string | null>(null);
  readonly decidindo = signal(false);
  readonly tamanho = computed(() => this.justificativa().trim().length);

  abrir(alvo: AlvoDecisao, decisao: Decisao): void {
    this.alvo.set(alvo);
    this.justificativa.set('');
    this.erroJustificativa.set(null);
    this.erroGeral.set(null);
    this.decisao.set(decisao);
  }

  fechar(): void {
    this.decisao.set(null);
  }

  async decidir(): Promise<void> {
    const [alvo, decisao] = [this.alvo(), this.decisao()];
    if (!alvo || !decisao) {
      return;
    }
    const erro = validarJustificativa(this.justificativa());
    if (erro) {
      this.erroJustificativa.set(erro);
      return;
    }
    this.decidindo.set(true);
    try {
      const atualizado = await this.aprovacao.decidir(
        alvo.grupo,
        alvo.entidade,
        alvo.id,
        decisao,
        this.justificativa().trim(),
        tratarNoComponente(400, 409),
      );
      this.decisao.set(null);
      this.mensagens.add({
        severity: 'success',
        summary: decisao === 'APROVAR' ? 'Item aprovado.' : 'Item rejeitado.',
        detail: decisao === 'APROVAR' ? undefined : 'O autor pode corrigir e reenviar.',
      });
      void this.pendentes.atualizar();
      this.decidido.emit(atualizado);
    } catch (e) {
      const problema = lerProblema(e);
      const doCampo = problema.erros['justificativa'];
      if (doCampo) {
        this.erroJustificativa.set(doCampo.join(' '));
      } else {
        this.erroGeral.set(problema.detalhe ?? mensagemDoErro(problema.codigo, problema.status));
      }
    } finally {
      this.decidindo.set(false);
    }
  }
}
