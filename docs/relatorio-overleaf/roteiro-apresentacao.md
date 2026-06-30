# Roteiro de Apresentação - Sistema Pata Feliz

## 1. Abertura

Bom dia/boa noite. Nós vamos apresentar o Sistema de Informação Pata Feliz, desenvolvido para a disciplina de Banco de Dados 2.

O sistema foi pensado para uma clínica veterinária e tem como objetivo organizar o atendimento de tutores, animais, veterinários, procedimentos, agenda, prontuários e lembretes.

Durante a apresentação, vamos mostrar os requisitos funcionais, a arquitetura do sistema, o modelo de banco de dados, os recursos de Banco de Dados 2 utilizados e uma demonstração do sistema em execução.

## 2. Problema e Objetivo do Sistema

Uma clínica veterinária precisa lidar com várias informações ao mesmo tempo: dados dos tutores, animais, consultas, procedimentos, veterinários disponíveis, prontuários e retornos.

O objetivo do Pata Feliz é centralizar essas informações em um sistema web com banco de dados relacional, permitindo operações de cadastro, consulta, atualização e remoção de dados.

O sistema também busca evitar problemas comuns, como choque de horários na agenda, agendamento em datas inválidas e falta de controle sobre vacinas, consultas futuras e animais sem atendimento recente.

## 3. Perfis de Usuário

O sistema trabalha com três perfis principais.

O administrador possui acesso às funções de gestão da clínica, como cadastro de clientes, animais, veterinários, procedimentos, bloqueios de agenda, lembretes e relatórios.

O veterinário consegue visualizar sua agenda, acessar dados dos animais e tutores, alterar status de atendimentos, registrar prontuários e informar valores adicionais.

O tutor ou cliente pode cadastrar seus animais, agendar atendimentos, acompanhar consultas, visualizar prontuários liberados e consultar lembretes relacionados aos seus animais.

## 4. Requisitos Funcionais

Entre os principais requisitos funcionais, o sistema permite login por e-mail ou CPF e senha.

Também diferencia permissões entre administrador, veterinário e tutor.

Permite cadastrar e editar clientes, animais, veterinários e procedimentos.

Permite registrar atendimentos com data, horário, veterinário, animal, procedimento, status e valores.

Também registra prontuários vinculados ao atendimento, animal e veterinário.

Além disso, gera lembretes automáticos para consultas próximas, vacinas vencendo, vacinas vencidas e animais sem atendimento recente.

Por fim, o sistema disponibiliza relatórios de serviços, veterinários e histórico clínico do animal.

## 5. Arquitetura do Sistema

A arquitetura foi dividida em três camadas.

A primeira camada é o frontend, desenvolvido com HTML, CSS e JavaScript. Ele é responsável pelas telas, formulários, calendário, filtros e chamadas HTTP.

A segunda camada é o backend, desenvolvido com Node.js e Express. Ele trata autenticação, autorização, regras de negócio e comunicação com o banco.

A terceira camada é o banco de dados PostgreSQL, onde ficam as tabelas, views, funções armazenadas, triggers e restrições de integridade.

Essa divisão permite separar a interface, a lógica da aplicação e a persistência dos dados.

## 6. Modelo de Banco de Dados

O banco de dados possui várias tabelas relacionadas, atendendo ao requisito de manipular mais de uma estrutura de armazenamento.

As principais tabelas são: usuarios, clientes, veterinarios, animais, procedimentos, atendimentos, prontuarios, vacinas_aplicadas, lembretes e bloqueios_agenda.

A tabela usuarios concentra os dados de login e tipo de usuário.

Clientes e veterinários complementam os dados específicos de cada perfil.

Animais ficam ligados aos clientes.

Atendimentos ligam animal, cliente, veterinário e procedimento.

Prontuários ficam vinculados aos atendimentos e aos animais.

Lembretes e bloqueios de agenda dão suporte às regras automáticas do sistema.

## 7. Operações CRUD

O sistema atende ao requisito de usar os quatro comandos básicos da SQL.

O comando SELECT aparece nas listagens, relatórios, histórico do animal e consultas de agenda.

O comando INSERT aparece no cadastro de usuários, clientes, animais, procedimentos, atendimentos, bloqueios e prontuários.

O comando UPDATE aparece na edição de perfil, clientes, veterinários, animais, procedimentos, status de atendimentos e lembretes.

O comando DELETE aparece na exclusão de bloqueios de agenda e lembretes.

Essas operações são chamadas pelo backend e executadas no PostgreSQL.

## 8. Conexão com a Base de Dados

A conexão com o banco fica centralizada no arquivo backend/db.js.

O sistema usa variáveis de ambiente para configurar host, usuário, senha, nome do banco, porta e SSL.

Para PostgreSQL, é utilizada a biblioteca pg.

O backend envia comandos SQL parametrizados para o banco, evitando montar valores diretamente nas strings de consulta.

Essa camada também possui suporte a transações, com beginTransaction, commit e rollback.

## 9. Uso de Transações

As transações foram usadas em funcionalidades que envolvem mais de uma operação no banco.

Um exemplo é o cadastro de cliente.

Primeiro o sistema insere um registro na tabela usuarios.

Depois insere os dados complementares na tabela clientes.

Essas duas operações precisam acontecer juntas. Se uma delas falhar, a transação é desfeita com rollback.

Também há transações em edição de clientes, edição de veterinários e edição de perfil.

Isso garante consistência entre tabelas relacionadas.

## 10. Consultas com Junções

O sistema possui várias consultas com JOIN.

Um exemplo importante é a listagem da agenda, que une atendimentos, animais, clientes, usuários, veterinários e procedimentos.

Essa consulta permite mostrar em uma única tela dados como data do atendimento, nome do animal, tutor, veterinário, procedimento, status e valores.

Também há junções em prontuários, relatórios e histórico clínico do animal.

Esse ponto atende ao requisito do roteiro de possuir pelo menos uma consulta SQL com uso de junções.

## 11. Procedure e Funções Armazenadas

O sistema possui uma procedure real no PostgreSQL chamada atualizar_status_lembrete.

Ela recebe três parâmetros: o id do lembrete, o novo status e o id do usuário responsável.

O backend chama essa procedure usando CALL, por exemplo: CALL atualizar_status_lembrete(...).

Essa parte atende diretamente ao requisito do roteiro sobre stored procedure com passagem de parâmetro.

Além da procedure, parte das buscas foi movida para funções armazenadas no PostgreSQL.

A função buscar_historico_animal recebe o id do animal como parâmetro e retorna o histórico clínico, incluindo atendimento, tutor, veterinário, procedimento, status, valores e dados do prontuário.

Também foram criadas funções como listar_clientes, listar_animais, listar_atendimentos, listar_prontuarios, listar_lembretes, relatorio_servicos e relatorio_veterinarios.

Com isso, o backend deixa de manter consultas grandes diretamente no código e passa a chamar rotinas do banco, como CALL atualizar_status_lembrete(...) e SELECT * FROM listar_atendimentos(...).

Esse ponto atende ao requisito de usar stored procedure com passagem de parâmetro e também demonstra funções armazenadas para consultas e relatórios.

## 12. Triggers e Automações

O banco também possui triggers.

Algumas triggers atualizam automaticamente o campo atualizado_em quando registros são alterados.

Outras triggers disparam a geração automática de lembretes quando há inserção ou atualização em atendimentos ou vacinas aplicadas.

A função gerar_lembretes_automaticos cria lembretes para consultas próximas, vacinas vencendo, vacinas vencidas e animais sem atendimento recente.

Isso mostra que o banco não está apenas armazenando dados, mas também executando regras importantes da aplicação.

## 13. Regras de Agendamento

O sistema possui regras para impedir agendamentos inválidos.

Não é permitido agendar no passado.

Também não é permitido agendar com mais de um ano de antecedência.

De segunda a sexta, o horário permitido é de 08:00 às 18:00.

Aos sábados, o horário permitido é de 08:00 às 12:00.

Domingos são indisponíveis.

Além disso, o banco usa uma restrição EXCLUDE USING GIST para impedir choque de atendimentos do mesmo veterinário.

Também existem bloqueios de agenda para impedir marcações em períodos específicos.

## 14. Demonstração do Sistema

Na demonstração, a primeira etapa é fazer login com um usuário de teste.

Depois, mostrar o dashboard e explicar que as informações mudam conforme o perfil logado.

Em seguida, mostrar a listagem de animais, clientes, veterinários ou procedimentos.

Depois, realizar ou explicar um agendamento, destacando as regras de data, horário e conflito de agenda.

Também é importante mostrar um prontuário, pois ele representa o registro clínico do atendimento.

Por fim, mostrar os lembretes e os relatórios, incluindo o histórico do animal gerado por função armazenada.

## 15. Pontos do Roteiro Atendidos

O trabalho atende à implementação de um Sistema de Informação.

O sistema realiza inserção, seleção, atualização e remoção de dados.

Utiliza mais de uma tabela relacionada no banco.

Possui conexão explícita com a base de dados.

Utiliza transações em funcionalidades com mais de uma operação SQL.

Possui consultas com junções.

Utiliza funções armazenadas com parâmetros.

Também possui triggers, views e regras de integridade no banco.

## 16. Conclusão

O Pata Feliz cumpre a proposta do trabalho de Banco de Dados 2 ao integrar frontend, backend e PostgreSQL em um sistema funcional.

Além das operações CRUD, o sistema usa recursos importantes de banco de dados, como transações, junções, funções armazenadas, triggers, views, constraints e múltiplas tabelas relacionadas.

Como resultado, o sistema resolve um problema prático de gestão veterinária e demonstra a aplicação dos conceitos estudados na disciplina.

## 17. Encerramento

Com isso, finalizamos a apresentação do Sistema de Informação Pata Feliz.

Obrigado pela atenção.

Agora ficamos à disposição para perguntas.
