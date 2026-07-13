import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { Order, OrderService } from '../../services/order.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n/translation.service';
import { orderStatusKey } from '../../i18n/status-labels';

type ChatViewState = 'loading' | 'ready' | 'denied' | 'unavailable' | 'error';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit, OnDestroy {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private i18n = inject(TranslationService);

  readonly orderStatusKey = orderStatusKey;

  @ViewChild('messageList') private messageListEl?: ElementRef<HTMLDivElement>;

  orderId = 0;
  order = signal<Order | null>(null);
  messages = signal<ChatMessage[]>([]);
  viewState = signal<ChatViewState>('loading');
  errorMessage = signal<string | null>(null);

  draft = '';
  sendError = signal<string | null>(null);
  private lastUnsentDraft: string | null = null;

  currentUserId = this.authService.currentUser()?.sub ?? null;
  isCourier = this.authService.isCourier();

  otherPartyLabelKey = signal('chat.otherPartyDefault');

  connectionState = this.chatService.connectionState;

  /**
   * Mirrors ChatServiceImpl's TERMINAL_STATUSES (DELIVERED/CANCELLED) so the input is
   * greyed out immediately rather than waiting on a rejected send to arrive over
   * /user/queue/chat/errors - the backend still enforces this independently either way.
   */
  isOrderTerminal = computed(() => {
    const status = this.order()?.status;
    return status === 'DELIVERED' || status === 'CANCELLED';
  });

  canSend = computed(() => this.connectionState() === 'connected' && !this.isOrderTerminal());

  ngOnInit(): void {
    this.orderId = Number(this.route.snapshot.paramMap.get('orderId'));
    if (!this.orderId) {
      this.viewState.set('error');
      this.errorMessage.set(this.i18n.t('chat.invalidOrder'));
      return;
    }

    this.otherPartyLabelKey.set(this.isCourier ? 'chat.otherPartyCustomer' : 'chat.otherPartyCourier');
    this.loadOrderContext();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }

  private loadOrderContext(): void {
    this.orderService.getOrder(this.orderId).subscribe({
      next: (order) => this.order.set(order),
      error: () => {},
    });
  }

  private loadHistory(): void {
    this.viewState.set('loading');

    this.chatService.getHistory(this.orderId).subscribe({
      next: (page) => {
        this.messages.set(page.content);
        this.viewState.set('ready');
        this.scrollToBottomSoon();
        this.connectRealtime();
      },
      error: (err) => {
        if (err?.status === 403) {
          this.viewState.set('denied');
          this.errorMessage.set(this.i18n.t('chat.accessDenied'));
        } else if (err?.status === 409) {
          this.viewState.set('unavailable');
          this.errorMessage.set(err.error?.message ?? this.i18n.t('chat.unavailable'));
        } else if (err?.status === 401) {
          this.viewState.set('error');
          this.errorMessage.set(this.i18n.t('chat.sessionExpired'));
        } else {
          this.viewState.set('error');
          this.errorMessage.set(this.i18n.t('chat.loadFailed'));
        }
      },
    });
  }

  private connectRealtime(): void {
    this.chatService.connect(
      this.orderId,
      (message) => {
        this.messages.update((current) => [...current, message]);
        this.scrollToBottomSoon();
      },
      (reason) => {
        this.sendError.set(reason);
      }
    );
  }

  send(): void {
    const content = this.draft.trim();
    if (!content || this.isOrderTerminal()) {
      return;
    }

    this.sendError.set(null);
    this.lastUnsentDraft = this.draft;
    this.chatService.send(this.orderId, content);
    this.draft = '';
  }

  retryUnsent(): void {
    if (this.lastUnsentDraft !== null) {
      this.draft = this.lastUnsentDraft;
      this.lastUnsentDraft = null;
    }
    this.sendError.set(null);
  }

  isOwnMessage(message: ChatMessage): boolean {
    return message.senderUserId === this.currentUserId;
  }



  formatTime(sentAt: string): string {
    return new Date(sentAt).toLocaleString();
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }

  private scrollToBottomSoon(): void {
    setTimeout(() => {
      const el = this.messageListEl?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
