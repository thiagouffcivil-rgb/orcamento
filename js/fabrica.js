// ==========================================
// 1. GESTÃO DA FÁBRICA DE COMPOSIÇÕES
// ==========================================

window.selectFabricaModoRadio = function(element, modo) {
    document.querySelectorAll('#fabrica-modo-group .radio-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    element.querySelector('input[type="radio"]').checked = true;

    const panelManual = document.getElementById('fabrica-panel-manual');
    const panelAdaptar = document.getElementById('fabrica-panel-adaptar');
    const panelIngredientes = document.getElementById('fabrica-panel-ingredientes-container');

    panelManual.classList.add('hidden');
    panelAdaptar.classList.add('hidden');
    panelIngredientes.classList.add('hidden');

    if (modo === 'manual') {
        panelManual.classList.remove('hidden');
    } else if (modo === 'adaptar') {
        panelAdaptar.classList.remove('hidden');
        panelIngredientes.classList.remove('hidden');
    } else if (modo === 'mista') {
        panelIngredientes.classList.remove('hidden');
    }
    window.calcularECoberturaCustoFabrica();
};

window.carregarReceitaMae = function() {
    const codigoMae = document.getElementById('input-sinapi-mae').value.trim();
    if (!codigoMae) { alert('Por favor, informe o código da composição mãe.'); return; }

    const estadoConfig = document.getElementById('select-estado').value;
    const tabela = document.getElementById('select-tabela').value;

    const compPropria = window.appState.databases.base_propria.find(i => String(i['Código']) === codigoMae);
    if (compPropria) {
        if (Array.isArray(compPropria.ingredientes) && compPropria.ingredientes.length > 0) {
            window.appState.fabricaRecipe = JSON.parse(JSON.stringify(compPropria.ingredientes));
            window.appState.fabricaRecipe.forEach(ing => {
                if(ing.tipoItem !== 'avulso_inventado') {
                    ing.precoUnitario = window.obterPrecoItemPorCodigoETipo(ing.codigoItem, ing.tipoItem, estadoConfig, tabela);
                }
            });
            document.getElementById('input-fabrica-descricao').value = `ADAPTADO: ${compPropria['Descrição'] || ''}`;
            document.getElementById('input-fabrica-unidade').value = compPropria['Unidade'] || 'UN';
            window.renderizarTabelaReceitaFabrica();
            return;
        } else {
            alert(`A composição própria ${codigoMae} foi criada no modo "Preço Fixo" e não possui uma receita detalhada para ser adaptada.`); 
            return;
        }
    }

    const analiticoSINAPI = window.appState.databases.sinapi_analitico || [];
    const analiticoSCO = window.appState.databases.sco_analitico || [];
    const analiticoCompleto = analiticoSINAPI.concat(analiticoSCO);

    const receitaEncontrada = analiticoCompleto.filter(item => String(item['Código'] || item['Código Mãe'] || '').trim() === codigoMae);
    if (receitaEncontrada.length === 0) { alert(`Nenhuma receita encontrada para o código ${codigoMae}.`); return; }

    window.appState.fabricaRecipe = receitaEncontrada.map(item => {
        const codigoItem = item['Código do Item'] || item['Código Item'] || item['Código'];
        const tipoBruto = String(item['Tipo Item'] || 'INSUMO').toLowerCase();
        const isSubComp = tipoBruto.includes('composicao') || tipoBruto === 'comp';
        
        // INTELIGÊNCIA: Descobrir se o item filho é da SCO através do prefixo
        const isSCOItem = String(codigoItem).startsWith('SCO') || String(codigoItem).startsWith('AD ') || String(codigoItem).startsWith('MAT') || String(codigoItem).startsWith('MOD') || String(codigoItem).startsWith('MOI') || String(codigoItem).startsWith('EQ ') || String(codigoItem).startsWith('IEQ') || String(codigoItem).startsWith('REQ');

        // Mapeamento correto para a base de dados
        const tipoItem = isSubComp ? (isSCOItem ? 'sco_composicao' : 'composicao') : (isSCOItem ? 'sco_insumo' : 'insumo');

        const descricao = item['Descrição'] || ''; 
        const unidade = item['Unidade'] || ''; 
        const coeficiente = parseFloat(item['Coeficiente']) || 1.0;
        const grupo = String(item['Tipo Item'] || item['Grupo'] || 'MATERIAL').toUpperCase();
        
        const precoUnitario = window.obterPrecoItemPorCodigoETipo(codigoItem, tipoItem, estadoConfig, tabela);

        return { codigoItem: codigoItem, tipoItem: tipoItem, descricao: descricao, unidade: unidade, coeficiente: coeficiente, precoUnitario: precoUnitario, grupo: grupo };
    });

    const isSCO = codigoMae.startsWith('SCO-') || codigoMae.startsWith('AD ');
    let compMaeObj = null;
    if(isSCO) compMaeObj = ((tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd).find(i => String(i['Código']) === codigoMae);
    else {
        compMaeObj = ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd).find(i => String(i['Código']) === codigoMae);
        if(!compMaeObj) compMaeObj = ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp).find(i => String(i['Código']) === codigoMae);
    }
    
    if (compMaeObj) {
        if (!document.getElementById('input-fabrica-descricao').value) document.getElementById('input-fabrica-descricao').value = `ADAPTADO: ${compMaeObj['Descrição'] || ''}`;
        if (!document.getElementById('input-fabrica-unidade').value) document.getElementById('input-fabrica-unidade').value = compMaeObj['Unidade'] || 'UN';
    }
    window.renderizarTabelaReceitaFabrica();
};

window.adicionarIngredienteAvulsoInventado = function() {
    const inputCodigo = document.getElementById('input-avulso-codigo'); 
    const inputDescricao = document.getElementById('input-avulso-descricao');
    const inputUnidade = document.getElementById('input-avulso-unidade'); 
    const inputPreco = document.getElementById('input-avulso-preco');
    const selectGrupo = document.getElementById('select-avulso-grupo'); 
    const inputCoef = document.getElementById('input-avulso-coef');

    const codigo = inputCodigo ? inputCodigo.value.trim() || `INV-${Date.now().toString().slice(-4)}` : `INV-01`;
    const descricao = inputDescricao ? inputDescricao.value.trim() : ''; 
    const unidade = inputUnidade ? inputUnidade.value.trim() || 'UN' : 'UN';
    const preco = inputPreco ? parseFloat(inputPreco.value) || 0 : 0; 
    const grupo = selectGrupo ? selectGrupo.value : 'MATERIAL';
    const coeficiente = inputCoef ? parseFloat(inputCoef.value) || 1.0 : 1.0;

    if (!descricao) { alert('Por favor, informe a descrição do insumo inventado.'); if (inputDescricao) inputDescricao.focus(); return; }

    window.appState.fabricaRecipe.push({ codigoItem: codigo, tipoItem: 'avulso_inventado', descricao: descricao, unidade: unidade, coeficiente: coeficiente, precoUnitario: preco, grupo: grupo });

    if (inputCodigo) inputCodigo.value = ''; if (inputDescricao) inputDescricao.value = ''; if (inputUnidade) inputUnidade.value = '';
    if (inputPreco) inputPreco.value = ''; if (inputCoef) inputCoef.value = '1.0000';
    window.renderizarTabelaReceitaFabrica();
};

window.renderizarTabelaReceitaFabrica = function() {
    const tbody = document.getElementById('tbody-fabrica-receita');
    if (!tbody) return;
    if (window.appState.fabricaRecipe.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum ingrediente na receita.</td></tr>`;
        window.calcularECoberturaCustoFabrica(); return;
    }

    tbody.innerHTML = window.appState.fabricaRecipe.map((item, idx) => {
        const totalItem = (item.coeficiente * item.precoUnitario) || 0;
        return `<tr>
            <td><strong>${item.codigoItem}</strong></td>
            <td><span class="header-badge" style="font-size:0.7rem; background:#64748b;">${(item.grupo || item.tipoItem).toUpperCase()}</span></td>
            <td>${item.descricao}</td>
            <td class="text-center">${item.unidade}</td>
            <td class="text-right"><input type="number" step="0.0001" min="0" value="${item.coeficiente}" style="width: 110px; text-align: right; padding: 4px 6px;" onchange="atualizarCoeficienteIngrediente(${idx}, this.value)"></td>
            <td class="text-right">${window.formatBRL(item.precoUnitario)}</td>
            <td class="text-right"><strong>${window.formatBRL(totalItem)}</strong></td>
            <td class="text-center"><button class="btn btn-sm btn-danger" onclick="removerIngredienteReceita(${idx})">❌ Remover</button></td>
        </tr>`;
    }).join('');
    window.calcularECoberturaCustoFabrica();
};

window.atualizarCoeficienteIngrediente = function(index, novoCoef) {
    if (window.appState.fabricaRecipe[index]) {
        window.appState.fabricaRecipe[index].coeficiente = parseFloat(novoCoef) || 0;
        window.calcularECoberturaCustoFabrica();
        const tbody = document.getElementById('tbody-fabrica-receita');
        if (tbody && tbody.rows[index]) {
            const item = window.appState.fabricaRecipe[index]; 
            const totalItem = (item.coeficiente * item.precoUnitario) || 0;
            tbody.rows[index].cells[6].innerHTML = `<strong>${window.formatBRL(totalItem)}</strong>`;
        }
    }
};

window.removerIngredienteReceita = function(index) { 
    window.appState.fabricaRecipe.splice(index, 1); 
    window.renderizarTabelaReceitaFabrica(); 
};

window.adicionarIngredienteManualAorReceita = function() {
    const codigo = document.getElementById('input-ingrediente-codigo').value.trim();
    const tipo = document.getElementById('select-ingrediente-tipo').value;
    const grupo = document.getElementById('select-ingrediente-grupo').value;
    const coeficiente = parseFloat(document.getElementById('input-ingrediente-coef').value) || 1.0;

    if (!codigo) { alert('Por favor, informe o Código do item ingrediente.'); return; }

    const estadoConfig = document.getElementById('select-estado').value;
    const tabela = document.getElementById('select-tabela').value;

    let dbItem = null;
    if (tipo === 'composicao') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd).find(i => String(i['Código']) === codigo) || ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp).find(i => String(i['Código']) === codigo);
    else if (tipo === 'insumo') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd).find(i => String(i['Código']) === codigo) || ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp).find(i => String(i['Código']) === codigo);
    else if (tipo === 'sco_composicao') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd).find(i => String(i['Código']) === codigo);
    else if (tipo === 'sco_insumo') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd).find(i => String(i['Código']) === codigo);
    else if (tipo === 'base_propria') dbItem = window.appState.databases.base_propria.find(i => String(i['Código']) === codigo);

    const descricao = dbItem ? dbItem['Descrição'] : `Item Ingrediente (${codigo})`;
    const unidade = dbItem ? dbItem['Unidade'] : 'UN';
    const precoUnitario = window.obterPrecoItemPorCodigoETipo(codigo, tipo, estadoConfig, tabela);

    window.appState.fabricaRecipe.push({ codigoItem: codigo, tipoItem: tipo, descricao: descricao, unidade: unidade, coeficiente: coeficiente, precoUnitario: precoUnitario, grupo: grupo });
    document.getElementById('input-ingrediente-codigo').value = ''; 
    window.renderizarTabelaReceitaFabrica();
};

window.calcularECoberturaCustoFabrica = function() {
    const modoEl = document.querySelector('input[name="fabrica_modo"]:checked'); 
    const modo = modoEl ? modoEl.value : 'manual';
    let custoTotal = 0;

    if (modo === 'manual') {
        const inputManual = document.getElementById('input-fabrica-preco-manual'); 
        custoTotal = inputManual ? parseFloat(inputManual.value) || 0 : 0;
    } else {
        const estadoConfig = document.getElementById('select-estado').value; 
        const tabela = document.getElementById('select-tabela').value;
        custoTotal = window.appState.fabricaRecipe.reduce((acc, item) => {
            if (item.tipoItem === 'avulso_inventado') return acc + (item.coeficiente * item.precoUnitario);
            const precoAtual = window.obterPrecoItemPorCodigoETipo(item.codigoItem, item.tipoItem, estadoConfig, tabela);
            return acc + (item.coeficiente * (precoAtual || item.precoUnitario || 0));
        }, 0);
    }

    const custoTotalEl = document.getElementById('fabrica-custo-total');
    if (custoTotalEl) custoTotalEl.innerText = window.formatBRL(custoTotal);
    return custoTotal;
};

window.fabricarESalvarComposicao = function() {
    const codigo = document.getElementById('input-fabrica-codigo').value.trim(); 
    const descricao = document.getElementById('input-fabrica-descricao').value.trim();
    const unidade = document.getElementById('input-fabrica-unidade').value.trim();
    const modoEl = document.querySelector('input[name="fabrica_modo"]:checked'); 
    const modo = modoEl ? modoEl.value : 'manual';

    if (!codigo || !descricao || !unidade) { alert('Por favor, preencha o Código Próprio, a Descrição e a Unidade.'); return; }
    const precoCalculado = window.calcularECoberturaCustoFabrica();
    if (precoCalculado <= 0) { if (!confirm('O preço calculado da composição é R$ 0,00. Deseja salvar mesmo assim?')) return; }

    const states = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
    const grupoManual = document.getElementById('select-fabrica-grupo-manual') ? document.getElementById('select-fabrica-grupo-manual').value : 'COMPOSICAO';

    const novaComposicao = { 
        'Código': codigo, 
        'Descrição': descricao, 
        'Unidade': unidade, 
        'Grupo': (modo === 'manual' ? grupoManual : 'COMPOSICAO'), 
        'ingredientes': modo !== 'manual' ? JSON.parse(JSON.stringify(window.appState.fabricaRecipe)) : [] 
    };
    
    states.forEach(st => novaComposicao[st] = precoCalculado);

    const idxExistente = window.appState.databases.base_propria.findIndex(i => String(i['Código']) === codigo);
    if (idxExistente >= 0) { 
        window.appState.databases.base_propria[idxExistente] = novaComposicao; 
        alert(`Composição ${codigo} atualizada!`); 
    } else { 
        window.appState.databases.base_propria.push(novaComposicao); 
        alert(`Composição ${codigo} salva com sucesso!`); 
    }

    document.getElementById('input-fabrica-codigo').value = ''; 
    document.getElementById('input-fabrica-descricao').value = ''; 
    document.getElementById('input-fabrica-unidade').value = '';
    if (document.getElementById('input-fabrica-preco-manual')) document.getElementById('input-fabrica-preco-manual').value = '';
    
    window.appState.fabricaRecipe = []; 
    window.renderizarTabelaReceitaFabrica(); 
    window.atualizarOrcamentoEBusca();
};

// ==========================================
// 2. CURVA ABC E LEVANTAMENTO
// ==========================================

window.gerarLevantamentoCurvaABC = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) { alert('O orçamento está vazio. Adicione itens ao orçamento primeiro.'); return; }

    const estadoConfig = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value;
    const insumosMap = new Map();

    function adicionarAoMap(codigo, descricao, unidade, tipoItem, qtd, precoUnitarioManual, origem, grupoExplicito) {
        if (!codigo || codigo === '-') return; 
        const key = String(codigo).trim();
        if (insumosMap.has(key)) {
            const existing = insumosMap.get(key); 
            existing.qtdTotal += qtd;
            if (!existing.descricao && descricao) existing.descricao = descricao;
            if ((!existing.unidade || existing.unidade === 'UN') && unidade) existing.unidade = unidade;
            if (!existing.grupo && grupoExplicito) existing.grupo = grupoExplicito;
        } else {
            insumosMap.set(key, { codigo: key, descricao: descricao, unidade: unidade || 'UN', tipoItem: tipoItem || '', qtdTotal: qtd, precoUnitarioManual: precoUnitarioManual || 0, origem: origem || '', grupo: grupoExplicito || tipoItem || '' });
        }
    }

    function explodirComposicao(codigoComp, qtdComp, tipoBase, nivel = 0) {
        if (tipoBase === 'base_propria') {
            const compPropria = window.appState.databases.base_propria.find(i => String(i['Código']).trim() === String(codigoComp).trim());
            if (compPropria && Array.isArray(compPropria.ingredientes) && compPropria.ingredientes.length > 0) {
                compPropria.ingredientes.forEach(ing => {
                    const qtdTotalFilho = qtdComp * (parseFloat(ing.coeficiente) || 1.0);
                    if (ing.tipoItem === 'avulso_inventado') { 
                        adicionarAoMap(ing.codigoItem, ing.descricao, ing.unidade, ing.grupo, qtdTotalFilho, ing.precoUnitario, 'base_propria', ing.grupo); 
                        return; 
                    }
                    const isSubComp = String(ing.tipoItem).includes('composicao') || String(ing.tipoItem) === 'sco_composicao' || String(ing.tipoItem) === 'base_propria';
                    if (isSubComp && nivel < 2) explodirComposicao(ing.codigoItem, qtdTotalFilho, ing.tipoItem, nivel + 1);
                    else adicionarAoMap(ing.codigoItem, ing.descricao, ing.unidade, ing.tipoItem, qtdTotalFilho, ing.precoUnitario, 'base_propria', ing.grupo);
                });
                return;
            }
            adicionarAoMap(codigoComp, compPropria ? compPropria['Descrição'] : `Composição ${codigoComp}`, compPropria ? compPropria['Unidade'] : 'UN', 'COMPOSICAO', qtdComp, 0, 'base_propria', compPropria ? compPropria.Grupo : 'COMPOSICAO'); 
            return;
        }

        const isSCO = tipoBase === 'sco_composicao' || String(codigoComp).startsWith('SCO-') || String(codigoComp).startsWith('AD ');
        const analiticoBase = isSCO ? window.appState.databases.sco_analitico : window.appState.databases.sinapi_analitico;
        const filhos = (analiticoBase || []).filter(item => String(item['Código Mãe'] || item['Código'] || '').trim() === String(codigoComp).trim());

        if (filhos.length === 0) { adicionarAoMap(codigoComp, `Composição ${codigoComp}`, 'UN', 'COMPOSICAO', qtdComp, 0, tipoBase); return; }

        filhos.forEach(filho => {
            const codFilho = String(filho['Código do Item'] || filho['Código Item'] || filho['Código'] || '').trim();
            const descFilho = filho['Descrição'] || ''; 
            const unidFilho = filho['Unidade'] || ''; 
            const coefFilho = parseFloat(filho['Coeficiente']) || 1.0;
            const tipoItem = String(filho['Tipo Item'] || filho['Grupo'] || '').toUpperCase(); 
            const qtdTotalFilho = qtdComp * coefFilho;
            const isSubComp = tipoItem.includes('COMPOS') || tipoItem === 'COMP';

            if (isSubComp && nivel < 2) explodirComposicao(codFilho, qtdTotalFilho, tipoBase, nivel + 1);
            else adicionarAoMap(codFilho, descFilho, unidFilho, tipoItem, qtdTotalFilho, 0, tipoBase, tipoItem);
        });
    }

    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa') return;
        if (item.tipo === 'composicao' || item.tipo === 'sco_composicao' || item.tipo === 'base_propria') explodirComposicao(item.codigo, item.qtd, item.tipo, 0);
        else if (item.tipo === 'insumo' || item.tipo === 'sco_insumo') adicionarAoMap(item.codigo, item.descricao, item.unidade, 'INSUMO', item.qtd, item.precoUnitario, item.tipo);
        else if (item.tipo === 'item_avulso') { 
            const chaveAvulso = item.id ? `AVULSO-${item.id}` : item.descricao; 
            adicionarAoMap(chaveAvulso, item.descricao, item.unidade, item.grupo || 'MATERIAL', item.qtd, item.precoUnitario, 'item_avulso', item.grupo); 
        }
    });

    const mapaSCO = { 'MOD': 'MÃO DE OBRA', 'MOI': 'MÃO DE OBRA', 'MAT': 'MATERIAL', 'IEQ': 'EQUIPAMENTO', 'REQ': 'EQUIPAMENTO', 'EQ ': 'EQUIPAMENTO', 'EVE': 'EVENTUAIS', 'TRI': 'TRIBUTOS', 'RSE': 'SERVIÇOS' };

    const listaInsumos = Array.from(insumosMap.values()).map(insumo => {
        let precoUnitario = parseFloat(insumo.precoUnitarioManual) || 0;
        const isSCO = insumo.origem === 'sco_composicao' || insumo.origem === 'sco_insumo' || insumo.codigo.startsWith('SCO-') || insumo.codigo.startsWith('MOD') || insumo.codigo.startsWith('MOI') || insumo.codigo.startsWith('MAT') || insumo.codigo.startsWith('IEQ') || insumo.codigo.startsWith('REQ') || insumo.codigo.startsWith('EQ ') || insumo.codigo.startsWith('EVE') || insumo.codigo.startsWith('TRI') || insumo.codigo.startsWith('RSE') || insumo.codigo.startsWith('AD ');

        let baseInsumos = isSCO ? ((tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd);
        let baseInsumosSP = isSCO ? [] : ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp);
        
        let achado = (baseInsumos || []).find(i => String(i['Código']).trim() === insumo.codigo);

        if (!achado && !isSCO && insumo.origem !== 'base_propria') achado = (baseInsumosSP || []).find(i => String(i['Código']).trim() === insumo.codigo);

        if (!achado) {
            const baseComps = isSCO ? ((tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd);
            const baseCompsSP = isSCO ? [] : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp);
            achado = (baseComps || []).find(i => String(i['Código']).trim() === insumo.codigo);
            if (!achado && !isSCO && insumo.origem !== 'base_propria') achado = (baseCompsSP || []).find(i => String(i['Código']).trim() === insumo.codigo);
        }

        if (achado) {
            if (precoUnitario <= 0) {
                const tipoInferido = (insumo.origem.includes('composicao') || insumo.tipoItem.includes('composicao')) ? 'composicao' : 'insumo';
                precoUnitario = window.obterPrecoItemPorCodigoETipo(insumo.codigo, isSCO ? `sco_${tipoInferido}` : tipoInferido, estadoConfig, tabela);
            }
            if (!insumo.descricao || insumo.descricao.startsWith('Composição ')) insumo.descricao = achado['Descrição'] || insumo.descricao;
            if (!insumo.unidade || insumo.unidade === 'UN') insumo.unidade = achado['Unidade'] || insumo.unidade;
        }

        const prefixoSCO = insumo.codigo.substring(0, 3).toUpperCase();
        if (mapaSCO[prefixoSCO]) insumo.grupo = mapaSCO[prefixoSCO];
        else if (achado && achado['Grupo']) insumo.grupo = String(achado['Grupo']).toUpperCase().trim();
        else if (!insumo.grupo && insumo.tipoItem) insumo.grupo = insumo.tipoItem.toUpperCase();

        return { ...insumo, precoUnitario: precoUnitario, custoTotal: (insumo.qtdTotal * precoUnitario) || 0 };
    });

    const listaMaoDeObra = []; const listaMateriais = [];

    listaInsumos.forEach(item => {
        const grupo = (item.grupo || item.tipoItem || '').toUpperCase(); 
        const cod = (item.codigo || '').toUpperCase(); 
        const desc = (item.descricao || '').toUpperCase(); 

        let isMaoDeObra = false;
        if (grupo.includes('MÃO DE OBRA') || grupo.includes('MAO DE OBRA') || cod.startsWith('MOD') || cod.startsWith('MOI') || desc.includes('(HORISTA)') || desc.includes('(MENSALISTA)')) {
            isMaoDeObra = true;
        }
        if (cod.startsWith('EQ ') || cod.startsWith('IEQ') || cod.startsWith('REQ') || grupo.includes('EQUIPAMENTO')) {
            isMaoDeObra = false;
        }

        if (isMaoDeObra) listaMaoDeObra.push(item);
        else listaMateriais.push(item);
    });

    listaMaoDeObra.sort((a, b) => b.custoTotal - a.custoTotal); 
    listaMateriais.sort((a, b) => b.custoTotal - a.custoTotal);
    
    window.appState.cachedMaoDeObra = listaMaoDeObra; 
    window.appState.cachedMateriaisABC = listaMateriais;
    window.renderizarTabelasCurvaABC(listaMaoDeObra, listaMateriais);
};

window.renderizarTabelasCurvaABC = function(listaMaoDeObra, listaMateriais) {
    const containerMaoDeObra = document.getElementById('container-tabela-mao-de-obra'); 
    const containerMateriais = document.getElementById('container-tabela-materiais');
    containerMaoDeObra.classList.remove('hidden'); 
    containerMateriais.classList.remove('hidden');

    const tbodyMaoDeObra = document.getElementById('tbody-mao-de-obra'); 
    let totalCustoHH = 0;
    
    if (listaMaoDeObra.length === 0) {
        tbodyMaoDeObra.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum insumo de Mão de Obra encontrado.</td></tr>`;
    } else {
        tbodyMaoDeObra.innerHTML = listaMaoDeObra.map(item => { 
            totalCustoHH += (parseFloat(item.custoTotal) || 0); 
            return `<tr><td><strong>${item.codigo}</strong></td><td>${item.descricao}</td><td class="text-center">${item.unidade}</td><td class="text-right">${item.qtdTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="text-right">${window.formatBRL(item.precoUnitario)}</td><td class="text-right"><strong>${window.formatBRL(item.custoTotal)}</strong></td></tr>`; 
        }).join('');
    }
    document.getElementById('tfoot-hh-total-custo').innerText = window.formatBRL(totalCustoHH);

    const tbodyMateriais = document.getElementById('tbody-materiais-abc');
    const somaTotalMateriais = listaMateriais.reduce((acc, item) => acc + (parseFloat(item.custoTotal) || 0), 0); 
    let custoAcumulado = 0;
    
    if (listaMateriais.length === 0) {
        tbodyMateriais.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum material ou equipamento encontrado.</td></tr>`;
    } else {
        tbodyMateriais.innerHTML = listaMateriais.map((item) => {
            custoAcumulado += (parseFloat(item.custoTotal) || 0);
            const percTotal = somaTotalMateriais > 0 ? (item.custoTotal / somaTotalMateriais) * 100 : 0; 
            const percAcum = somaTotalMateriais > 0 ? (custoAcumulado / somaTotalMateriais) * 100 : 0;
            let classeABC = 'A'; let classeBadge = 'badge-a';
            if (percAcum > 95.0) { classeABC = 'C'; classeBadge = 'badge-c'; } else if (percAcum > 80.0) { classeABC = 'B'; classeBadge = 'badge-b'; }
            item.classeABC = classeABC; item.percTotal = percTotal; item.percAcum = percAcum;
            return `<tr><td class="text-center"><span class="badge-abc ${classeBadge}">${classeABC}</span></td><td><strong>${item.codigo}</strong></td><td>${item.descricao}</td><td class="text-center">${item.unidade}</td><td class="text-right">${item.qtdTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td><td class="text-right">${window.formatBRL(item.precoUnitario)}</td><td class="text-right"><strong>${window.formatBRL(item.custoTotal)}</strong></td><td class="text-right">${percTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td><td class="text-right">${percAcum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td></tr>`;
        }).join('');
    }
    document.getElementById('tfoot-materiais-total-custo').innerText = window.formatBRL(somaTotalMateriais); 
    containerMaoDeObra.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.gerarCurvaABCOrcamento = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) { alert('O orçamento está vazio.'); return; }
    
    const estadoConfig = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value; 
    const bdi = parseFloat(document.getElementById('input-bdi').value) || 0;
    const itensValidos = window.appState.orcamento.filter(item => item.tipo !== 'etapa');

    const listaCalculada = itensValidos.map(item => {
        const precoUnitarioBase = window.obterPrecoAtualizadoDoItem(item, estadoConfig, tabela);
        const precoComBdi = precoUnitarioBase * (1 + bdi / 100); 
        const custoTotal = precoComBdi * item.qtd;
        return { ...item, precoComBdi: precoComBdi, custoTotal: custoTotal };
    });
    
    listaCalculada.sort((a, b) => b.custoTotal - a.custoTotal);
    const somaTotal = listaCalculada.reduce((acc, item) => acc + item.custoTotal, 0); 
    let custoAcumulado = 0;

    const tbody = document.getElementById('tbody-abc-orcamento');
    if (listaCalculada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum serviço válido para cálculo.</td></tr>`;
    } else {
        tbody.innerHTML = listaCalculada.map((item) => {
            custoAcumulado += item.custoTotal;
            const percTotal = somaTotal > 0 ? (item.custoTotal / somaTotal) * 100 : 0; 
            const percAcum = somaTotal > 0 ? (custoAcumulado / somaTotal) * 100 : 0;
            let classeABC = 'A'; let classeBadge = 'badge-a';
            if (percAcum > 95.0) { classeABC = 'C'; classeBadge = 'badge-c'; } else if (percAcum > 80.0) { classeABC = 'B'; classeBadge = 'badge-b'; }
            item.classeABC = classeABC; item.percTotal = percTotal; item.percAcum = percAcum;
            return `<tr><td class="text-center"><span class="badge-abc ${classeBadge}">${classeABC}</span></td><td>${item.itemEap}</td><td><strong>${item.codigo}</strong></td><td>${item.descricao}</td><td class="text-center">${item.unidade}</td><td class="text-right">${item.qtd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td><td class="text-right">${window.formatBRL(item.precoComBdi)}</td><td class="text-right"><strong>${window.formatBRL(item.custoTotal)}</strong></td><td class="text-right">${percTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td><td class="text-right">${percAcum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td></tr>`;
        }).join('');
    }
    document.getElementById('tfoot-abc-orcamento-total').innerText = window.formatBRL(somaTotal); 
    window.appState.cachedServicosABC = listaCalculada;
    
    document.getElementById('container-abc-orcamento').classList.remove('hidden'); 
    document.getElementById('section-abc-orcamento').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ==========================================
// 3. AUDITORIA DE PREÇOS
// ==========================================

window.auditarPrecosZerados = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) { alert('O orçamento está vazio. Adicione itens primeiro para realizar a auditoria.'); return; }
    
    const container = document.getElementById('container-auditoria-zerados'); 
    container.innerHTML = `<div style="padding:15px; color:var(--text-muted);">A varrer toda a árvore de composições do orçamento...</div>`; 
    container.classList.remove('hidden');
    
    const estadoConfig = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value; 
    const relatorio = [];

    function verificarComposicao(codigoComp, nomeComp, tipoBase, arvore = '') {
        const path = arvore ? `${arvore} ➔ ${codigoComp}` : codigoComp;

        if (tipoBase === 'base_propria') {
            const compPropria = window.appState.databases.base_propria.find(i => String(i['Código']).trim() === String(codigoComp).trim());
            if (compPropria && Array.isArray(compPropria.ingredientes)) {
                compPropria.ingredientes.forEach(ing => {
                    let precoAtual = 0;
                    if (ing.tipoItem === 'avulso_inventado') precoAtual = parseFloat(ing.precoUnitario) || 0;
                    else precoAtual = window.obterPrecoItemPorCodigoETipo(ing.codigoItem, ing.tipoItem, estadoConfig, tabela);

                    if (precoAtual <= 0) relatorio.push(`<strong>Cód: ${ing.codigoItem}</strong> (${ing.descricao}) <br><span style="color:#64748b; font-size:0.85rem;">📍 Escondido dentro de: ${path}</span>`);
                    if (String(ing.tipoItem).includes('composicao') || ing.tipoItem === 'base_propria') verificarComposicao(ing.codigoItem, ing.descricao, ing.tipoItem, path);
                });
            }
            return;
        }

        const isSCO = tipoBase === 'sco_composicao' || String(codigoComp).startsWith('SCO-') || String(codigoComp).startsWith('AD ');
        const analiticoBase = isSCO ? window.appState.databases.sco_analitico : window.appState.databases.sinapi_analitico;
        const filhos = (analiticoBase || []).filter(item => String(item['Código Mãe'] || item['Código'] || '').trim() === String(codigoComp).trim());

        filhos.forEach(filho => {
            const codFilho = String(filho['Código do Item'] || filho['Código Item'] || filho['Código'] || '').trim();
            const tipoItem = String(filho['Tipo Item'] || filho['Grupo'] || '').toUpperCase(); 
            const descFilho = filho['Descrição'] || '';
            const isSubComp = tipoItem.includes('COMPOS') || tipoItem === 'COMP'; 
            const tipoInferido = isSubComp ? (isSCO ? 'sco_composicao' : 'composicao') : (isSCO ? 'sco_insumo' : 'insumo');
            
            const precoFilho = window.obterPrecoItemPorCodigoETipo(codFilho, tipoInferido, estadoConfig, tabela);
            if (precoFilho <= 0) relatorio.push(`<strong>Cód: ${codFilho}</strong> (${descFilho}) <br><span style="color:#64748b; font-size:0.85rem;">📍 Escondido dentro de: ${path}</span>`);
            if (isSubComp) verificarComposicao(codFilho, descFilho, tipoInferido, path);
        });
    }

    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa') return;
        const precoItemBase = window.obterPrecoAtualizadoDoItem(item, estadoConfig, tabela);
        if (precoItemBase <= 0 && item.tipo !== 'composicao' && item.tipo !== 'sco_composicao' && item.tipo !== 'base_propria') {
           relatorio.push(`<strong>Cód: ${item.codigo || 'S/ Código'}</strong> (${item.descricao}) <br><span style="color:#64748b; font-size:0.85rem;">📍 Lançado diretamente na EAP (Item ${item.itemEap})</span>`);
        }
        if (item.tipo === 'composicao' || item.tipo === 'sco_composicao' || item.tipo === 'base_propria') verificarComposicao(item.codigo, item.descricao, item.tipo, `Orçamento (EAP: ${item.itemEap})`);
    });

    const relatorioUnico = [...new Set(relatorio)];
    if (relatorioUnico.length === 0) {
        container.innerHTML = `<div style="padding: 15px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 6px;">✅ <strong>Auditoria concluída:</strong> Excelente! Nenhum insumo com preço R$ 0,00 foi encontrado na árvore do orçamento (<strong>${estadoConfig} + Fallback SP</strong>).</div>`;
    } else {
        container.innerHTML = `<div style="padding: 15px; background: #fffbeb; color: #92400e; border: 1px solid #fde68a; border-radius: 6px;"><h4 style="margin-bottom: 12px; font-size: 1.05rem;">⚠️️ Atenção: ${relatorioUnico.length} item(ns) da receita sem preço (nem em ${estadoConfig} nem em SP)!</h4><ul style="margin-left: 20px; line-height: 1.6;">${relatorioUnico.map(r => `<li style="margin-bottom: 8px;">${r}</li>`).join('')}</ul><div style="margin-top: 15px; font-size: 0.9rem; color: #b45309; border-top: 1px solid #fde68a; padding-top: 10px;"><strong>Como resolver:</strong> Copie o código listado acima, vá à <strong>Fábrica</strong>, utilize o modo <em>Adaptar Composição</em> e precifique o ingrediente.</div></div>`;
    }
};

// ==========================================
// 4. MÓDULO DE INTELIGÊNCIA (IA & PROMPTS)
// ==========================================

window.atualizarFabricaComposicoes = function() {
    const select = document.getElementById('fabrica-select-item');
    if (!select || !window.appState.orcamento) return;

    let html = '<option value="">-- Escolha um item do orçamento --</option>';
    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa' && item.codigo && item.codigo !== '-') {
            html += `<option value="${item.codigo}" data-desc="${item.descricao}">${item.codigo} - ${item.descricao.substring(0, 50)}...</option>`;
        }
    });
    select.innerHTML = html;
};

window.prepararPromptFabrica = function() {
    const select = document.getElementById('fabrica-select-item');
    const txtArea = document.getElementById('fabrica-prompt-gerado');
    const option = select.options[select.selectedIndex];
    
    if (!select.value) {
        txtArea.value = '';
        return;
    }

    const codigo = select.value;
    const descricao = option.getAttribute('data-desc');

    const itemOrc = window.appState.orcamento.find(i => i.codigo === codigo);
    let detalhesInsumos = itemOrc && itemOrc.ingredientes ? JSON.stringify(itemOrc.ingredientes) : "Considere a tabela SINAPI/SCO padrão para este serviço.";

    txtArea.value = `Atue como Engenheiro Civil especialista em Planeamento e Custos de Obras Públicas. 
Analise o seguinte serviço de engenharia:
- Código: ${codigo}
- Descrição: ${descricao}
- Dados de insumos/composição: ${detalhesInsumos}

Com base nisso, forneça APENAS um objeto JSON cru (sem markdown, sem texto adicional) estruturado exatamente com estas chaves:
{
  "codigo": "${codigo}",
  "turma": "Descrição otimizada da equipe padrão (ex: 1 Pedreiro + 1 Servente)",
  "producaoDiaria": [Número inteiro ou decimal representando a produção da turma por dia na unidade do serviço],
  "unidade": "Unidade de medida do serviço",
  "espera": [Número de dias corridos de espera técnica/cura pós-execução, se aplicável, ou 0]
}`;
};

window.copiarPromptFabrica = function() {
    const txtArea = document.getElementById('fabrica-prompt-gerado');
    if (!txtArea.value) return alert("Selecione um serviço primeiro.");
    navigator.clipboard.writeText(txtArea.value);
    alert("📋 Prompt copiado para a área de transferência! Cole na sua IA de preferência.");
};

window.salvarComposicaoFabrica = function() {
    const rawJson = document.getElementById('fabrica-json-entrada').value.trim();
    if (!rawJson) return alert("Cole o JSON fornecido pela IA.");

    try {
        let cleanJson = rawJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
        const obj = JSON.parse(cleanJson);

        if (!obj.codigo || obj.producaoDiaria === undefined) {
            return alert("Erro: O JSON precisa conter pelo menos as chaves 'codigo' e 'producaoDiaria'.");
        }

        window.appState.baseComposicoesPrazos[obj.codigo] = obj;

        alert(`✅ Sucesso! Parâmetros de produtividade para o item [${obj.codigo}] salvos na base local.`);
        document.getElementById('fabrica-json-entrada').value = '';
        
        window.atualizarCronogramaComBaseLocal();

    } catch (err) {
        console.error(err);
        alert("❌ Erro ao processar o JSON. Certifique-se de colar um objeto JSON válido.");
    }
};

window.atualizarCronogramaComBaseLocal = function() {
    if (!window.appState.orcamento) return;
    
    let aplicados = 0;
    window.appState.orcamento.forEach(item => {
        if (window.appState.baseComposicoesPrazos[item.codigo] && parseFloat(item.qtd) > 0) {
            const config = window.appState.baseComposicoesPrazos[item.codigo];
            if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', espera: 0 };
            
            let dias = Math.ceil(parseFloat(item.qtd) / config.producaoDiaria);
            item.cronograma.hh = dias * 8;
            item.cronograma.equipe = 1;
            item.cronograma.espera = config.espera || 0;
            aplicados++;
        }
    });

    if (aplicados > 0 && typeof window.carregarTabelaCronograma === 'function') {
        window.carregarTabelaCronograma();
        if (typeof window.gerarGraficoGantt === 'function') window.gerarGraficoGantt();
    }
};

window.exportarBaseComposicoes = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.appState.baseComposicoesPrazos, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "base_fabrica_composicoes.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
};