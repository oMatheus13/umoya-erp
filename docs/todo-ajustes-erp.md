# TODO – Ajustes ERP (Pedidos, OP, Lotes, Estoque)

Objetivo: deixar a ERP mais “chão de fábrica” antes de avançar para o novo app (POP – Painel de Operacoes).
Escopo: **somente** nomeação/identificadores + melhorias de OP/Lote + entrada/ajuste de estoque por comprimento.

---

## 1) Identificadores humanos para Pedido, OP e Lote (SKU-like)

### 1.1 Regras gerais
- Todo **Pedido**, **Ordem de Produção (OP)** e **Lote** deve ter:
  - `code` (string curta, legível por humanos, única)
  - `seq` (inteiro sequencial por tipo, por ano ou global)
  - `created_at`
- O `code` deve ser gerado automaticamente ao criar o registro e não mudar depois.
- O `code` não substitui o `id` (UUID). Ele é “nome” e referência visual.

### 1.2 Formato sugerido (simples e forte)
Escolha UM padrão para os três tipos, variando apenas o prefixo:

- **Pedido:** `PED-YYYY-000123`
- **OP:** `OP-YYYY-000123`
- **Lote:** `LOT-YYYY-000123`

Vantagens: fácil, limpo, escalável, não depende de regra de produto.

> Observação: você comentou “SKU com material/tipo/variação/tamanho”. Para **produto** isso faz sentido.
> Para **pedido/OP/lote**, o melhor é ID simples + metadados (produto, tamanho, etc).
> Se quiser “código mais rico”, veja 1.3.

### 1.3 (Opcional) Código rico com produto + tamanho
Se você quiser um “code” que já diga o que é, use este padrão para OP e Lote:

- **OP:** `OP-YYYY-000123-VIG-0450`  (viga 4,50 m)
- **Lote:** `LOT-YYYY-000123-PDG-080` (pingadeira 80 cm)

Regras:
- `ITEMCODE` vem do produto (ex.: `VIG`, `PDG`).
- `SIZE` é o comprimento em cm sem ponto (4,50 m → `0450`; 0,80 m → `080`).
- Pedido pode ficar só com sequencial (`PED-YYYY-000123`) para não virar um texto gigante.

### 1.4 Implementação (como fazer sem gambiarra)
- Criar uma tabela/coleção `sequences`:
  - `key` (ex.: `PED-2026`, `OP-2026`, `LOT-2026`)
  - `current_value` (int)
- Na criação do registro:
  1) trava/transaction na sequência
  2) incrementa
  3) monta `code`
  4) salva no registro final

**Critério de aceite**
- Criar pedido/OP/lote em paralelo nunca duplica código.
- Código aparece em listagens, detalhes, impressão e pesquisa.

---

## 2) OP com progresso real (parcial por dia)

### 2.1 Campos mínimos na OP
- `planned_qty` (unidades) OU `planned_length_m` (metros)
- `produced_qty`/`produced_length_m` (acumulado)
- `status` (ABERTA | EM_ANDAMENTO | PARCIAL | CONCLUIDA | CANCELADA)
- `linked_order_id` (pedido opcional)

### 2.2 Apontamentos (registro por dia)
Criar entidade `production_entries` (apontamentos):
- `op_id`
- `employee_id`
- `date`
- `qty` OU `length_m`
- `scrap_qty`/`scrap_length_m` (opcional)
- `notes`

Regra:
- OP soma os apontamentos e atualiza progresso.
- OP mostra “faltam X”.

**Critério de aceite**
- Uma OP grande permite registrar produção diária.
- A tela mostra progresso (feito/falta) e histórico.

---

## 3) Lotes por dia (rastreabilidade simples)

### 3.1 Criação de lote
Opções:
A) Lote por apontamento (automático)
B) Lote por dia (recomendado, mais limpo)

Recomendado (B):
- Ao registrar um apontamento, o sistema:
  - encontra ou cria `LOT-YYYY-xxxxx` para aquele dia e OP
  - adiciona itens produzidos naquele dia

### 3.2 Relação
- Um lote pode referenciar:
  - 1 OP (preferível)
  - 1 produto
  - 1 tamanho (quando aplicável)

**Critério de aceite**
- Você consegue abrir um lote e ver “o que foi produzido, quando, por quem”.

---

## 4) Estoque com “comprimento” como pseudo-variação (sem criar variação real)

Objetivo: no estoque, permitir entrada/ajuste com **produto + comprimento** (quando o produto for “por metro”).

### 4.1 Modelo de estoque sugerido
Criar conceito de “SKU de estoque” (stock item) para produtos por comprimento:

- `stock_items`
  - `product_id`
  - `length_m` (nullable)
  - `unit` (un | m)
  - `on_hand_qty` (int) ou `on_hand_length_m` (decimal)
  - `reserved_qty/length` (opcional)
  - `code` (opcional, ex.: `VIG-0450`)

Regras:
- Se produto é **unitário** (pingadeira): `length_m = null`, controla por `qty`.
- Se produto é **linear por tamanho** (viga): `length_m obrigatório`, controla por `qty` (unidades daquela medida) **e** pode calcular metros total = `qty * length_m`.

### 4.2 Entrada/ajuste de estoque (UI)
Copiar a lógica de “selecionar tamanho” que já existe em:
- pedido
- OP

Para estoque:
- selecionar produto
- se produto for “por metro”:
  - input comprimento (m)
  - input quantidade (unidades)
- salvar e atualizar `stock_items` correspondente

**Critério de aceite**
- Registrar estoque de viga 4,50 m: produto=viga, tamanho=4,50, qty=10.
- Estoque lista como: `Viga (4,50 m) – 10 un – 45,0 m total`.
- Não exige criar variação de produto.

---

## 5) Financeiro: pagar mão de obra descontando do caixa escolhido
- Em “Pagamentos”, ao pagar:
  - escolher `cashbox_id` (bancário, físico, operacional etc)
  - gerar lançamento automático no financeiro (saída)
  - vincular ao apontamento/OP (se existir)

**Critério de aceite**
- Pagar um apontamento: baixa no caixa correto e aparece em lançamentos.

---

## 6) Ordem de implementação sugerida (pra não quebrar tudo)
1) Sequências + `code` em Pedido/OP/Lote
2) Apontamento de produção + progresso da OP
3) Lote por dia vinculado à OP
4) Estoque com pseudo-variação por comprimento
5) Pagamento integrado ao caixa

---

## 7) Checklist final (antes do novo app)
- [ ] Pedido mostra `code` e pesquisa por `code`
- [ ] OP mostra progresso e faltante
- [ ] Apontamentos por dia funcionam
- [ ] Lotes ficam rastreáveis por dia/OP
- [ ] Estoque aceita produto + comprimento + qty
- [ ] Pagamento baixa no caixa escolhido automaticamente
