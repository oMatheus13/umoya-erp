# TODO – Novo App: POP (Painel de Operacoes) (PIN)

Objetivo: um app simples (mobile-first) para registrar **ponto** e **produção** sem navegar pela ERP.
Roda no mesmo repo e banco, como a PDV (apenas UI/rotas diferentes).

---

## 1) Conceito e nome
- Nome do módulo: **POP (Painel de Operacoes)**
- Rotas sugeridas: `/pop` ou `/apontamento`
- Uso atual: **celular compartilhado**
- Uso futuro: **tablet fixo na fábrica**

Regras de ouro:
- Não fica logado.
- Operação deve levar **até 10 segundos**.
- Após registrar, volta para a tela inicial.

---

## 2) Autenticação por PIN (sem biometria)
### 2.1 Dados necessários
No cadastro de funcionário:
- `pin` (hash, nunca em texto puro)
- `is_active`

### 2.2 Fluxo
1) Tela inicial com teclado numérico grande + campo PIN
2) Digita PIN → valida
3) Mostra nome + foto (se existir) e abre menu de ações
4) Ao concluir uma ação → confirmação rápida → volta pra tela PIN

### 2.3 Segurança mínima
- Bloqueio por 30s após 5 tentativas erradas
- Log de tentativa (timestamp + device info simples)
- Timeout: se ficar parado 20–30s na tela de ação, volta pro PIN

---

## 3) Ações do POP (MVP)
### 3.1 Bater ponto
- Botões grandes:
  - Entrada
  - Saída
  - Intervalo (opcional, se você usar)
- Registra em `presence_logs`:
  - `employee_id`
  - `type` (IN | OUT | BREAK_IN | BREAK_OUT)
  - `timestamp`
  - `device_id` (opcional)
  - `notes` (opcional)

### 3.2 Registrar produção (apontamento)
- Escolher:
  - OP (lista das OPs ABERTAS/EM_ANDAMENTO) **ou**
  - Pedido (se sua lógica gerar OP a partir do pedido)
- Depois inserir:
  - quantidade OU metros (conforme produto)
  - refugo (opcional)
  - observação curta (opcional)
- Salvar → cria `production_entries` vinculado à OP (ideal)
- Atualiza progresso da OP automaticamente

---

## 4) UX pro celular compartilhado
- Tela sempre limpa, fundo simples, botões grandes.
- Sem sidebar.
- Sem tabela longa.
- Busca rápida (se lista de OP crescer):
  - filtro por código (OP-YYYY-xxxxx)
  - filtro por cliente/obra (opcional)

---

## 5) UX pro tablet fixo (fase 2)
- Mesmo fluxo, só muda layout:
  - botões maiores
  - modo “kiosk” (tela cheia)
- (Opcional) QR Code futuro para login, mas **PIN primeiro**.

---

## 6) Permissões e auditoria
- Perfil “POP” só pode:
  - registrar ponto
  - registrar apontamento
  - ver lista curta de OPs
- Tudo deve gravar:
  - `created_by_employee_id`
  - `created_at`
  - `device_id` (se disponível)

---

## 7) Critérios de aceite do POP (MVP)
- [ ] Digitar PIN e entrar em menos de 2s
- [ ] Registrar ponto em 2 toques
- [ ] Registrar produção em poucos campos
- [ ] Sempre volta para a tela do PIN
- [ ] Registro aparece na ERP (Presença e Apontamentos)
- [ ] OP atualiza “faltam X” após apontamento

---

## 8) Ordem de implementação sugerida
1) Tela PIN + validação
2) Registro de ponto
3) Registro de produção (apontamento) vinculado à OP
4) Timeout + bloqueio por tentativas
5) Polimento de UI para mobile
