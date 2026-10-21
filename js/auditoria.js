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
        container.innerHTML = `<div style="padding: 15px; background: #fffbeb; color: #92400e; border: 1px solid #fde68a; border-radius: 6px;"><h4 style="margin-bottom: 12px; font-size: 1.05rem;">⚠ Atenção: ${relatorioUnico.length} item(ns) da receita sem preço (nem em ${estadoConfig} nem em SP)!</h4><ul style="margin-left: 20px; line-height: 1.6;">${relatorioUnico.map(r => `<li style="margin-bottom: 8px;">\${r}</li>`).join('')}</ul><div style="margin-top: 15px; font-size: 0.9rem; color: #b45309; border-top: 1px solid #fde68a; padding-top: 10px;"><strong>Como resolver:</strong> Copie o código listado acima, vá à <strong>Fábrica</strong>, utilize o modo <em>Adaptar Composição</em> e precifique o ingrediente.</div></div>`;
    }
};