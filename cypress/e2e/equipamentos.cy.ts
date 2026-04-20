import dadosTeste from '../fixtures/dados-teste.json';

const eq = dadosTeste.equipamento;

describe('Equipamentos', () => {
  beforeEach(() => {
    cy.loginAsSupervisor();
  });

  it('lista equipamentos', () => {
    cy.intercept('GET', '/api/equipamentos*').as('getEquipamentos');
    cy.visit('/equipamentos');
    cy.url().should('include', '/equipamentos');
    cy.wait('@getEquipamentos').its('response.statusCode').should('eq', 200);
  });

  it('cria um equipamento', () => {
    const codigoUnico = eq.codigo + '-' + Date.now();

    cy.intercept('POST', '/api/equipamentos').as('createEquipamento');
    cy.visit('/equipamentos/novo');
    cy.get('form').should('be.visible');

    cy.get('[data-cy="eq-codigo"]').should('be.visible').type(codigoUnico);
    cy.get('[data-cy="eq-nome"]').should('be.visible').type(eq.nome + ' Novo');
    cy.get('[data-cy="eq-tipo"]').should('be.visible').type(eq.tipo);
    cy.get('[data-cy="eq-localizacao"]').should('be.visible').type(eq.localizacao);
    cy.get('[data-cy="eq-setor"]').should('be.visible').clear().type(eq.setor);

    cy.get('button[type="submit"]').should('not.be.disabled').click();

    cy.wait('@createEquipamento').its('response.statusCode').should('eq', 201);
    cy.url().should('not.include', '/novo');
    cy.contains(eq.nome + ' Novo', { timeout: 15000 }).should('be.visible');
  });

  it('exibe detalhes de um equipamento', () => {
    cy.visit('/equipamentos');
    cy.contains(eq.nome).should('be.visible').click();
    cy.url().should('match', /\/equipamentos\/\d+/);
    cy.contains(eq.codigo).should('be.visible');
  });

  it('edita um equipamento', () => {
    cy.visit('/equipamentos');
    cy.contains(eq.nome).should('be.visible').click();
    cy.get('[data-cy="btn-editar-equipamento"]').should('be.visible').click();
    cy.get('[data-cy="eq-nome"]').should('be.visible').clear().type(`${eq.nome} Editado`);
    cy.get('button[type="submit"]').should('not.be.disabled').click();
    cy.contains(`${eq.nome} Editado`, { timeout: 10000 }).should('be.visible');
  });

  it('desativa um equipamento', () => {
    cy.visit('/equipamentos');
    // Esperar a linha aparecer
    cy.contains(`${eq.nome} Editado`, { timeout: 10000 }).should('be.visible');
    
    cy.get('[data-cy="equipamento-item"]').contains(`${eq.nome} Editado`)
      .parents('[data-cy="equipamento-item"]')
      .find('[data-cy="btn-deletar"]').click({ force: true });
      
    cy.get('button').contains(/Desativar|Confirmar/i).should('be.visible').click();
    
    cy.get('[data-cy="equipamento-item"]').contains(`${eq.nome} Editado`)
      .parents('[data-cy="equipamento-item"]')
      .contains('Inativo', { matchCase: false })
      .should('be.visible');
  });
});
