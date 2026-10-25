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
        
        const isSCOItem = String(codigoItem).startsWith('SCO') || String(codigoItem).startsWith('AD ') || String(codigoItem).startsWith('MAT') || String(codigoItem).startsWith('MOD') || String(codigoItem).startsWith('MOI') || String(codigoItem).startsWith('EQ ') || String(codigoItem).startsWith('IEQ') || String(codigoItem).startsWith('REQ');

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
    const inputJustificativa = document.getElementById('input-avulso-justificativa');
  
    const codigo = inputCodigo && inputCodigo.value.trim() ? inputCodigo.value.trim() : `INV-${Date.now().toString().slice(-4)}`;  
    const descricao = inputDescricao ? inputDescricao.value.trim() : '';   
    const unidade = inputUnidade && inputUnidade.value.trim() ? inputUnidade.value.trim() : 'UN';  
    const preco = inputPreco ? parseFloat(inputPreco.value) || 0 : 0;   
    const grupo = selectGrupo ? selectGrupo.value : 'MATERIAL';  
    const coeficiente = inputCoef ? parseFloat(inputCoef.value) || 1.0 : 1.0;  
    const justificativa = inputJustificativa ? inputJustificativa.value.trim() : '';
  
    if (!descricao) { alert('Por favor, informe a descrição do insumo inventado.'); if (inputDescricao) inputDescricao.focus(); return; }  
  
    window.appState.fabricaRecipe.push({ 
        codigoItem: codigo, 
        tipoItem: 'avulso_inventado', 
        descricao: descricao, 
        unidade: unidade, 
        coeficiente: coeficiente, 
        precoUnitario: preco, 
        grupo: grupo,
        justificativa: justificativa 
    });  
  
    if (inputCodigo) inputCodigo.value = ''; 
    if (inputDescricao) inputDescricao.value = ''; 
    if (inputUnidade) inputUnidade.value = '';  
    if (inputPreco) inputPreco.value = ''; 
    if (inputCoef) inputCoef.value = '1.0000';  
    
    if (inputJustificativa) inputJustificativa.value = '';
    const avisoDiv = document.getElementById('aviso-justificativa');
    if (avisoDiv) avisoDiv.style.display = 'none';

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

    custoTotal = window.arredondarMoeda(custoTotal);
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
        alert(`✅ Composição própria ${codigo} atualizada com sucesso!`); 
    } else { 
        window.appState.databases.base_propria.push(novaComposicao); 
        alert(`✅ Composição própria ${codigo} salva na Base Própria com sucesso!`); 
    }

    document.getElementById('input-fabrica-codigo').value = ''; 
    document.getElementById('input-fabrica-descricao').value = ''; 
    document.getElementById('input-fabrica-unidade').value = '';
    if (document.getElementById('input-fabrica-preco-manual')) document.getElementById('input-fabrica-preco-manual').value = '';
    
    window.appState.fabricaRecipe = []; 
    window.renderizarTabelaReceitaFabrica(); 
    window.atualizarOrcamentoEBusca();
};

// Exportação e Importação JSON da Base Própria
window.salvarBasePropriaJSON = function() {
    if (!window.appState.databases.base_propria || window.appState.databases.base_propria.length === 0) {
        alert('A Base Própria está vazia. Fabrique ao menos uma composição antes de exportar.');
        return;
    }
    const jsonStr = JSON.stringify(window.appState.databases.base_propria, null, 2);
    window.downloadArquivo(jsonStr, `base_propria_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
};

window.importarBasePropriaJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importado = JSON.parse(e.target.result);
            const lista = Array.isArray(importado) ? importado : (Array.isArray(importado.itens) ? importado.itens : null);
            if (!lista) {
                alert('Formato inválido para Base Própria.');
                return;
            }
            window.appState.databases.base_propria = lista;
            window.atualizarOrcamentoEBusca();
            alert(`✅ Base Própria importada com sucesso (${lista.length} composições)!`);
        } catch (err) {
            console.error(err);
            alert('Erro ao ler o arquivo JSON da Base Própria.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

window.addEventListener('DOMContentLoaded', () => {
    const inputManual = document.getElementById('input-fabrica-preco-manual');
    if (inputManual) {
        inputManual.addEventListener('input', () => window.calcularECoberturaCustoFabrica());
    }
});
