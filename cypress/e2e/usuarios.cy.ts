import dadosTeste from '../fixtures/dados-teste.json';

const tecnico = dadosTeste.usuario_tecnico;

describe('Usuários', () => {
  beforeEach(() => {
    cy.loginAsSupervisor();
  });

  it('lista usuários', () => {
    cy.intercept('GET', '/api/usuarios').as('getUsuarios');
    cy.visit('/usuarios');
    cy.wait('@getUsuarios').its('response.statusCode').should('eq', 200);
  });

  it('cria um técnico', () => {
    const timestamp = Date.now();
    cy.visit('/usuarios/novo');
    cy.get('[data-cy="user-nome"]').type('Técnico Extra ' + timestamp);
    cy.get('[data-cy="user-email"]').type(`tecnico.${timestamp}@cypress.local`);
    cy.get('[data-cy="user-matricula"]').type('T-' + timestamp);
    cy.get('[data-cy="user-senha"]').type('Cypress@123');
    cy.get('[data-cy="user-perfil"]').select('TÉCNICO');
    cy.get('[data-cy="user-setor"]').type('Manutenção');
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/usuarios');
    cy.contains('Técnico Extra ' + timestamp).should('be.visible');
  });

  it('cria um solicitante', () => {
    const timestamp = Date.now();
    cy.visit('/usuarios/novo');
    cy.get('[data-cy="user-nome"]').type('Solicitante Extra ' + timestamp);
    cy.get('[data-cy="user-email"]').type(`solic.${timestamp}@cypress.local`);
    cy.get('[data-cy="user-matricula"]').type('S-' + timestamp);
    cy.get('[data-cy="user-senha"]').type('Cypress@123');
    cy.get('[data-cy="user-perfil"]').select('SOLICITANTE');
    cy.get('[data-cy="user-setor"]').type('Operação');
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/usuarios');
    cy.contains('Solicitante Extra ' + timestamp).should('be.visible');
  });

  it('edita um usuário', () => {
    cy.visit('/usuarios');
    // Procurar pelo nome do técnico que sabemos que existe no seed
    cy.contains(tecnico.nome).click();
    cy.get('[data-cy="user-setor"]').clear().type('Manutenção Industrial');
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/usuarios');
  });

  it('bloqueia acesso à lista de usuários para não supervisor', () => {
    cy.clearCookies();
    cy.clearLocalStorage();

    // Login via UI como técnico — garante que auth.login() seta o estado em memória corretamente
    cy.visit('/login');
    cy.get('#email').type(tecnico.email);
    cy.get('#password').type(tecnico.senha);
    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 10000 }).should('include', '/dashboard');

    // roleGuard deve redirecionar não-supervisores para /403
    cy.visit('/usuarios', { failOnStatusCode: false });
    cy.url({ timeout: 8000 }).should('include', '/403');
    cy.contains('Acesso Negado').should('be.visible');
  });
});
