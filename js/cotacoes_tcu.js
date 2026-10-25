// ==========================================
// 5. MÓDULO DE COTAÇÕES (TCU / Lei 14.133)
// ==========================================

/**
 * Calcula o preço de referência com base nas cotações de mercado,
 * aplicando as regras de dispersão estatística (TCU / Lei 14.133).
 */
window.analisarCotacoesTCU = function(cotacoes) {
    const valores = cotacoes.filter(v => v > 0);
    const n = valores.length;

    if (n === 0) return { valorAdotado: 0, justificativa: "Nenhuma cotação válida.", valido: false };
    if (n === 1) return { valorAdotado: valores[0], justificativa: "Apenas 1 cotação válida. Insuficiente para análise estatística.", valido: false };

    valores.sort((a, b) => a - b);
    const soma = valores.reduce((acc, val) => acc + val, 0);
    const media = soma / n;

    const somaDiferencasQuadrado = valores.reduce((acc, val) => acc + Math.pow(val - media, 2), 0);
    const variancia = somaDiferencasQuadrado / (n - 1);
    const desvioPadrao = Math.sqrt(variancia);

    const cv = desvioPadrao / media;

    let mediana = 0;
    const meio = Math.floor(n / 2);
    if (n % 2 !== 0) mediana = valores[meio];
    else mediana = (valores[meio - 1] + valores[meio]) / 2;

    let valorAdotado = 0;
    let justificativa = "";
    const cvPercentual = (cv * 100).toFixed(2).replace('.', ',');

    if (cv > 0.25) {
        valorAdotado = mediana;
        justificativa = `Alta dispersão identificada. Coeficiente de Variação (CV = ${cvPercentual}%) superior ao limite de 25%. Adotada a MEDIANA metodológica para mitigar distorções de mercado.`;
    } else {
        valorAdotado = media;
        justificativa = `Dispersão aceitável. Coeficiente de Variação (CV = ${cvPercentual}%) inferior a 25%. Adotada a MÉDIA aritmética das cotações.`;
    }

    if (n < 3) {
        justificativa += " ATENÇÃO: Quantidade de cotações inferior a 3. Exige justificação processual adicional conforme Lei 14.133/2021.";
    }

    return { n: n, media: media, mediana: mediana, cv: cv, valorAdotado: window.arredondarMoeda(valorAdotado), justificativa: justificativa, valido: n >= 3 };
};

let contadorCotacoes = 0;
window.contextoModalCotacoes = 'fabrica'; // 'fabrica' | 'orcamento' | { tipo: 'item_tabela', id: number }

window.abrirModalCotacoes = function(contexto = 'fabrica') {
    window.contextoModalCotacoes = contexto || 'fabrica';
    document.getElementById('modal-cotacoes').style.display = 'flex';
    document.getElementById('resultado-estatistico').style.display = 'none';
    
    const container = document.getElementById('container-linhas-cotacao');
    container.innerHTML = '';
    contadorCotacoes = 0;

    window.adicionarLinhaCotacao();
    window.adicionarLinhaCotacao();
    window.adicionarLinhaCotacao();
};

window.fecharModalCotacoes = function() {
    document.getElementById('modal-cotacoes').style.display = 'none';
};

window.adicionarLinhaCotacao = function() {
    contadorCotacoes++;
    const idAtual = contadorCotacoes;
    const container = document.getElementById('container-linhas-cotacao');

    const divLinha = document.createElement('div');
    divLinha.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;';
    divLinha.id = `linha-cotacao-${idAtual}`;

    const hoje = new Date().toISOString().split('T')[0];

    divLinha.innerHTML = `
        <label style="width: 25px; font-weight: bold; color: #64748b;">#${idAtual}</label>
        <input type="text" id="cot-fornecedor-${idAtual}" style="flex: 2; min-width: 150px;" placeholder="Nome do Fornecedor, CNPJ ou Link">
        <input type="date" id="cot-data-${idAtual}" style="flex: 1; min-width: 120px;" value="${hoje}" title="Data da Proposta">
        <input type="number" id="cot-valor-${idAtual}" class="input-cotacao" step="0.01" style="width: 120px;" placeholder="Valor (R$)">
        <button class="btn btn-outline" style="color: red; border-color: transparent; padding: 4px 8px;" onclick="removerLinhaCotacao(${idAtual})" title="Remover cotação">❌</button>
    `;

    container.appendChild(divLinha);
};

window.removerLinhaCotacao = function(id) {
    const linha = document.getElementById(`linha-cotacao-${id}`);
    if (linha) { linha.remove(); }
};

window.formatarDataBr = function(dataIso) {
    if (!dataIso) return "Data N/A";
    const partes = dataIso.split('-');
    if (partes.length !== 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

window.processarETransferirCotacoes = function() {
    const cotacoes = [];
    const fornecedoresForamInformados = [];
    const inputsValores = document.querySelectorAll('#container-linhas-cotacao input[type="number"]');
    
    inputsValores.forEach(inputValor => {
        const valor = parseFloat(inputValor.value);
        if (valor > 0) {
            const idLinha = inputValor.id.split('-').pop(); 
            const inputFornecedor = document.getElementById(`cot-fornecedor-${idLinha}`);
            const fornecedorBruto = inputFornecedor ? inputFornecedor.value.trim() : '';
            const nomeFornecedor = fornecedorBruto || `Fornecedor Ñ Ident. (#${idLinha})`;

            const inputData = document.getElementById(`cot-data-${idLinha}`);
            const dataProposta = inputData ? window.formatarDataBr(inputData.value) : 'Data N/A';

            cotacoes.push(valor);
            fornecedoresForamInformados.push(`${nomeFornecedor} (${dataProposta}: R$ ${valor.toFixed(2).replace('.', ',')})`);
        }
    });

    if (cotacoes.length === 0) {
        alert("Erro: Insira pelo menos uma cotação com valor maior que zero para continuar.");
        return;
    }
    
    const analise = window.analisarCotacoesTCU(cotacoes);

    if (!analise.valido) {
        const prosseguir = confirm("⚠️ Atenção: Você inseriu menos de 3 cotações.\n\nO TCU e a Lei nº 14.133/2021 recomendam um mínimo de 3 fontes. Utilizar menos exigirá justificativa adicional no seu processo.\n\nDeseja prosseguir e adotar este valor mesmo assim?");
        if (!prosseguir) { return; }
    }

    const listaEmpresas = fornecedoresForamInformados.join('; ');
    const justificativaCompleta = `${analise.justificativa} Base de Pesquisa: ${listaEmpresas}.`;

    const divResultado = document.getElementById('resultado-estatistico');
    divResultado.style.display = 'block';
    divResultado.innerHTML = `<strong>Valor Estatístico a Adotar: R$ ${analise.valorAdotado.toFixed(2).replace('.', ',')}</strong><br><br><em>Justificativa: ${justificativaCompleta}</em>`;

    setTimeout(() => {
        const ctx = window.contextoModalCotacoes;
        if (ctx === 'orcamento') {
            const inputPrecoOrc = document.getElementById('input-add-preco');
            const inputJustOrc = document.getElementById('input-add-justificativa');
            const avisoOrc = document.getElementById('aviso-justificativa-orcamento');
            if (inputPrecoOrc) inputPrecoOrc.value = analise.valorAdotado.toFixed(2);
            if (inputJustOrc) inputJustOrc.value = justificativaCompleta;
            if (avisoOrc) {
                avisoOrc.style.display = 'block';
                avisoOrc.innerText = `✅ Preço R$ ${analise.valorAdotado.toFixed(2).replace('.', ',')} calculado (${analise.n} cotações TCU/Lei 14.133).`;
            }
        } else if (ctx && typeof ctx === 'object' && ctx.tipo === 'item_tabela') {
            const item = window.appState.orcamento.find(i => i.id === ctx.id);
            if (item) {
                item.precoUnitario = analise.valorAdotado;
                item.justificativa = justificativaCompleta;
                if (typeof window.renderizarOrcamento === 'function') window.renderizarOrcamento();
            }
        } else {
            const inputPrecoFab = document.getElementById('input-avulso-preco');
            const inputJustFab = document.getElementById('input-avulso-justificativa');
            const avisoDiv = document.getElementById('aviso-justificativa');
            if (inputPrecoFab) inputPrecoFab.value = analise.valorAdotado.toFixed(2);
            if (inputJustFab) inputJustFab.value = justificativaCompleta;
            if (avisoDiv) {
                avisoDiv.style.display = 'block';
                avisoDiv.innerText = `✅ Preço de R$ ${analise.valorAdotado.toFixed(2).replace('.', ',')} fixado (Baseado em ${analise.n} cotações). Fontes vinculadas.`;
            }
        }

        window.fecharModalCotacoes();
    }, 900); 
};
