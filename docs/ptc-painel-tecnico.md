PTC – Painel Técnico
Visão Geral

O PTC é o módulo técnico da Umoya.

Ele é responsável por:

Cálculos estruturais simples (não engenharia normativa pesada)

Simulações de produção

Estimativas de material

Geração de listas técnicas para fábrica

Base para previsibilidade de prazo e custo

Ele não executa.
Ele não vende.
Ele não gerencia.

Ele calcula.

Propósito

Resolver 4 problemas reais:

Evitar erro de cálculo manual

Evitar mistura de medidas no chão de fábrica

Ter previsibilidade de material antes de aceitar pedido

Ter base concreta para definir prazo

Sem o PTC:

A produção vira tentativa e erro.

O orçamento vira chute.

O prazo vira promessa arriscada.

O que o PTC será no futuro (versão completa)
1️⃣ Projetos Técnicos

Um Projeto Técnico representa uma obra ou demanda.

Ele contém:

Cliente

Obra

Tipo de estrutura (laje, muro, mourão, etc)

Cômodos ou módulos

Parâmetros técnicos

Observações

2️⃣ Módulos de Cálculo

O PTC será modular.

Módulo Laje

Criação por cômodos (retângulos em cm)

Definição do sentido das vigotas

Acréscimo de beiral (cm)

Espaçamento entre vigotas

Tipo de EPS

Resultado:

Quantidade de vigotas

Comprimento por vigota

Lista agrupada de cortes

Quantidade de EPS

Área total

Módulo Mourão

Altura

Seção

Tipo de armadura

Volume de concreto

Ferro necessário

Peso estimado

Produção estimada por dia

Módulo Pingadeira / Muro

Comprimento total do muro

Modelo da pingadeira

Quantidade necessária

Estimativa de concreto

Futuro

Bloco estrutural

Paver

Cálculo de consumo por lote

Simulador de capacidade

3️⃣ Lista Técnica de Produção

Cada projeto gera:

Lista de cortes agrupada por comprimento

Lista de EPS

Lista de armaduras

Observações técnicas

Formato:

Comprimento | Quantidade | Status
5,70m | 30 un | ☐
4,50m | 12 un | ☐

Isso pode ser impresso para:

Cliente

Chão de fábrica

4️⃣ Previsão de Produção

Com base na capacidade cadastrada no sistema:

Capacidade diária = 120m
Capacidade segura = 100m

O PTC calcula:

Total de metros

Dias necessários

Data estimada de conclusão

E mostra alerta se não cabe no prazo.

5️⃣ Integração com ERP

O PTC não cria pedido automaticamente.

Ele oferece botão:

👉 Gerar Pedido
👉 Gerar OP

Mas só após confirmação.

Ele passa:

Lista de itens

Comprimentos

Quantidades

Datas sugeridas

6️⃣ Histórico

Cada projeto fica salvo.

Permite:

Duplicar projeto

Revisar cálculo

Ajustar medidas

Comparar versões

MVP – Versão 1

Agora vamos cortar o excesso.

O MVP precisa ter apenas:

1️⃣ Projeto de Laje por Cômodos

Nome do projeto

Cliente

Cômodos retangulares em cm

Sentido da vigota

Espaçamento fixo (config)

EPS padrão (config)

Saída:

Qtd vigotas

Lista agrupada de cortes

Qtd EPS

Total de metros

Sem visual gráfico.
Sem desenho.
Sem drag.

2️⃣ Lista de Produção Simples

Tabela agrupada

Botão imprimir PDF

3️⃣ Previsão Básica

Total de metros

Capacidade diária

Dias necessários

4️⃣ Botão Opcional

“Gerar Pedido” (abre modal)

Nada automático invisível.

O que NÃO terá no MVP

Editor estilo AutoCAD

Visualização gráfica da planta

Arrastar cômodos

Cálculo estrutural avançado

Simulação de carga

Cronograma avançado

Isso fica para fase 2.

Arquitetura

App separado:
ptc.umoya.com

Mesmo banco.
Mesmo login.
Módulo isolado.

Entidades principais:

projects
rooms
calculations
calculation_items
production_lists

Papel do PTC no ecossistema

ERP – organiza
PDV – vende
POP – executa
PTC – calcula

Sem conflito.
Sem sobreposição.
