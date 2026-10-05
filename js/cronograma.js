// ==========================================
// 1. GESTÃO DA TABELA DE CRONOGRAMA
// ==========================================

window.carregarTabelaCronograma = function() {
    const tbody = document.getElementById('tbody-cronograma');
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--danger);">O orçamento está vazio. Adicione itens primeiro.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.appState.orcamento.map((item) => {
        if (item.tipo === 'etapa') {
            return `<tr class="row-etapa"><td>${item.itemEap}</td><td colspan="6"><strong>${item.descricao}</strong></td></tr>`;
        }

        // Inicia objeto cronograma se não existir
        if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', espera: 0 };
        
        // Fórmula: HH / (Tamanho Equipa * 8 horas/dia)
        let duracao = item.cronograma.hh > 0 ? Math.ceil(item.cronograma.hh / (item.cronograma.equipe * 8)) : 1;

        return `
            <tr>
                <td><strong>${item.itemEap}</strong></td>
                <td style="font-size: 0.85rem;">${item.descricao}</td>
                <td class="text-right">
                    <input type="number" min="0" value="${item.cronograma.hh}" style="width: 80px; text-align: right; padding: 4px;" onchange="atualizarCrono(${item.id}, 'hh', this.value)">
                </td>
                <td class="text-center">
                    <input type="number" min="1" value="${item.cronograma.equipe}" style="width: 60px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'equipe', this.value)">
                </td>
                <td class="text-center"><strong id="duracao-${item.id}" style="color: var(--primary); font-size: 1.1rem;">${duracao}</strong></td>
                <td class="text-center">
                    <input type="text" placeholder="Ex: 1.1" value="${item.cronograma.predecessora}" style="width: 70px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'predecessora', this.value)">
                </td>
                <td class="text-center">
                    <input type="number" min="0" value="${item.cronograma.espera}" style="width: 60px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'espera', this.value)">
                </td>
            </tr>
        `;
    }).join('');
    
    window.atualizarSelectPrazos();
};

window.atualizarCrono = function(id, campo, valor) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item) {
        item.cronograma[campo] = (campo === 'predecessora') ? valor.trim() : (parseFloat(valor) || 0);
        
        if (campo === 'equipe' && item.cronograma.equipe < 1) item.cronograma.equipe = 1;

        if (campo === 'hh' || campo === 'equipe') {
            const duracao = item.cronograma.hh > 0 ? Math.ceil(item.cronograma.hh / (item.cronograma.equipe * 8)) : 1;
            document.getElementById(`duracao-${id}`).innerText = duracao;
        }
    }
};

// ==========================================
// 2. MOTOR DO GRÁFICO DE GANTT (GOOGLE CHARTS)
// ==========================================

window.gerarGraficoGantt = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) return;
    
    // Carrega o Google Charts
    google.charts.load('current', {'packages':['gantt']});
    google.charts.setOnLoadCallback(desenharGrafico);

    // FUNÇÃO AUXILIAR: Garante que a data cai num dia útil (avança fins de semana)
    function proximoDiaUtil(data) {
        let d = new Date(data.getTime());
        if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sábado avança para Segunda
        if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Domingo avança para Segunda
        return d;
    }

    function desenharGrafico() {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'Task ID');
        data.addColumn('string', 'Task Name');
        data.addColumn('string', 'Resource');
        data.addColumn('date', 'Start Date');
        data.addColumn('date', 'End Date');
        data.addColumn('number', 'Duration');
        data.addColumn('number', 'Percent Complete');
        data.addColumn('string', 'Dependencies');

        let rows = [];
        
        // 1. Prepara as Tarefas
        let tarefasValidas = window.appState.orcamento.filter(i => i.tipo !== 'etapa');
        let mapTarefas = {};
        
        let arrayCalculo = tarefasValidas.map(i => {
            let duracaoDias = (i.cronograma && i.cronograma.hh > 0) ? Math.ceil(i.cronograma.hh / (i.cronograma.equipe * 8)) : 1;
            let obj = {
                id: String(i.id), eap: i.itemEap, desc: i.descricao, 
                duracaoDias: duracaoDias, predEap: i.cronograma ? i.cronograma.predecessora : '',
                esperaDias: i.cronograma ? i.cronograma.espera : 0, start: null, end: null
            };
            mapTarefas[i.itemEap] = obj;
            return obj;
        });

        // Motor de Caminho Crítico 
        let baseDate = new Date(); // Inicia o projeto hoje
        baseDate.setHours(0,0,0,0);
        
        let mudou = true; let loops = 0;
        while(mudou && loops < 100) { 
            mudou = false; loops++;
            arrayCalculo.forEach(t => {
                let prevStart = t.start;
                
                // A) CÁLCULO DA DATA DE INÍCIO COM MÚLTIPLAS PREDECESSORAS
                let preds = t.predEap ? String(t.predEap).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];

                if (preds.length === 0) {
                    // Sem predecessora, arranca no próximo dia útil a partir de hoje
                    t.start = proximoDiaUtil(new Date(baseDate.getTime())); 
                } else {
                    let maxEndDate = new Date(baseDate.getTime());
                    let encontrouValida = false;

                    // Analisa TODAS as predecessoras fornecidas
                    preds.forEach(p => {
                        if (mapTarefas[p] && mapTarefas[p].end) {
                            if (mapTarefas[p].end.getTime() > maxEndDate.getTime()) {
                                maxEndDate = new Date(mapTarefas[p].end.getTime());
                            }
                            encontrouValida = true;
                        }
                    });

                    if (encontrouValida) {
                        let dataComEspera = new Date(maxEndDate.getTime());
                        dataComEspera.setDate(dataComEspera.getDate() + t.esperaDias);
                        t.start = proximoDiaUtil(dataComEspera);
                    } else {
                        t.start = proximoDiaUtil(new Date(baseDate.getTime()));
                    }
                }
                
                // B) CÁLCULO DA DATA DE FIM (Apenas Dias Úteis)
                if (t.start) {
                    let dataFim = new Date(t.start.getTime());
                    let diasUteisAdicionados = 0;
                    
                    while(diasUteisAdicionados < t.duracaoDias) {
                        dataFim.setDate(dataFim.getDate() + 1);
                        // Ignora Sábado (6) e Domingo (0) no consumo de dias da tarefa
                        if (dataFim.getDay() !== 0 && dataFim.getDay() !== 6) {
                            diasUteisAdicionados++;
                        }
                    }
                    t.end = dataFim;
                }
                
                // C) VERIFICAÇÃO DE MUDANÇA EM CASCATA
                if (!prevStart || prevStart.getTime() !== t.start.getTime()) mudou = true;
            });
        }

        // 2. Transfere os dados ajustados para o Google Charts
        arrayCalculo.forEach(t => {
            rows.push([
                t.id, 
                `${t.eap} - ${t.desc.substring(0, 35)}...`, 
                'Serviços', 
                t.start, 
                t.end, 
                null, 
                0, 
                null 
            ]);
        });

        data.addRows(rows);

        var options = {
            height: (rows.length * 42) + 50,
            gantt: { trackHeight: 30, labelStyle: { fontName: 'system-ui', fontSize: 12 } }
        };

        var chart = new google.visualization.Gantt(document.getElementById('gantt_chart_div'));
        chart.draw(data, options);
    }
};

// ==========================================
// 3. EXPORTAÇÃO E IMPORTAÇÃO DO CRONOGRAMA
// ==========================================

window.exportarCronogramaJSON = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        alert('Não há itens no orçamento para exportar.');
        return;
    }
    
    // Extrai apenas os dados enxutos para a IA ler/modificar
    const dadosCrono = window.appState.orcamento.filter(i => i.tipo !== 'etapa').map(i => ({
        itemEap: i.itemEap,
        equipe: i.cronograma ? i.cronograma.equipe : 1,
        predecessora: i.cronograma ? i.cronograma.predecessora : '',
        espera: i.cronograma ? i.cronograma.espera : 0
    }));

    window.downloadArquivo(JSON.stringify(dadosCrono, null, 2), `dados_cronograma_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
};

window.importarCronogramaJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importado = JSON.parse(e.target.result);
            if (Array.isArray(importado)) {
                importado.forEach(dado => {
                    const item = window.appState.orcamento.find(i => String(i.itemEap) === String(dado.itemEap));
                    if (item) {
                        if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', espera: 0 };
                        if (dado.equipe !== undefined) item.cronograma.equipe = dado.equipe;
                        if (dado.predecessora !== undefined) item.cronograma.predecessora = dado.predecessora;
                        if (dado.espera !== undefined) item.cronograma.espera = dado.espera;
                    }
                });
                window.carregarTabelaCronograma();
                window.gerarGraficoGantt();
                alert('Cronograma importado e aplicado aos serviços com sucesso!');
            } else {
                alert('O formato do ficheiro deve ser uma lista (Array) de itens.');
            }
        } catch (err) {
            alert('Erro ao ler o ficheiro JSON do cronograma.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};

// ==========================================
// 4. MOTOR DE CÁLCULO DE HH (HOMEM-HORA)
// ==========================================

window.calcularHHDosIngredientes = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) return;

    let basesDeDados = [];
    for (let key in window.appState.databases) {
        if (Array.isArray(window.appState.databases[key])) {
            basesDeDados.push(window.appState.databases[key]);
        }
    }

    let atualizados = 0;

    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa' && parseFloat(item.qtd) > 0) {
            
            let hhUnitario = 0;
            let lista = item.ingredientes || item.insumos || item.composicao || item.itens || [];

            if (lista.length === 0 && item.codigo && item.codigo !== '-') {
                for (let banco of basesDeDados) {
                    let compBanco = banco.find(c => String(c.codigo).trim() === String(item.codigo).trim() || String(c['Código']).trim() === String(item.codigo).trim());
                    if (compBanco) {
                        lista = compBanco.ingredientes || compBanco.insumos || compBanco.composicao || compBanco.itens || [];
                        break; 
                    }
                }
            }

            const undItem = item.unidade ? String(item.unidade).trim().toUpperCase() : '';
            if (lista.length === 0) {
                if (undItem === 'H' || undItem === 'CHP' || undItem === 'CHI') hhUnitario = 1;
                if (undItem === 'MES' || undItem === 'UN.MÊS') hhUnitario = 176; 
            } 
            else if (lista.length > 0) {
                lista.forEach(ing => {
                    const undIng = ing.unidade || ing['Unidade'] ? String(ing.unidade || ing['Unidade']).trim().toUpperCase() : '';
                    const tipoIng = ing.tipo || ing['Tipo Item'] ? String(ing.tipo || ing['Tipo Item']).trim().toLowerCase() : '';
                    
                    if (undIng === 'H' || undIng === 'CHP' || undIng === 'CHI' || tipoIng.includes('mao_de_obra') || tipoIng.includes('equipamento') || tipoIng.includes('mão de obra')) {
                        let coeficiente = parseFloat(ing.quantidade || ing.coeficiente || ing.consumo || ing.qtd || ing['Coeficiente']) || 0;
                        hhUnitario += coeficiente;
                    }
                });
            }

            if (hhUnitario > 0) {
                if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', espera: 0 };
                
                let hhTotal = hhUnitario * parseFloat(item.qtd);
                item.cronograma.hh = Math.ceil(hhTotal);
                atualizados++;
            }
        }
    });

    if (atualizados > 0) {
        alert(`✅ Sucesso! O Cronograma cruzou o orçamento com o Banco de Dados e calculou o HH para ${atualizados} serviços.`);
        window.carregarTabelaCronograma(); 
        window.gerarGraficoGantt();        
    } else {
        alert('⚠️ Aviso: O sistema não conseguiu cruzar os serviços com as composições no banco de dados.');
    }
};

// ==========================================
// 5. FÁBRICA DE PRAZOS (BANCO LOCAL)
// ==========================================

window.atualizarSelectPrazos = function() {
    const select = document.getElementById('select-servico-prazo');
    if (!select || !window.appState.orcamento) return;
    
    let html = '<option value="">-- Escolha um serviço --</option>';
    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa' && item.codigo && item.codigo !== '-') {
            html += `<option value="${item.codigo}">${item.codigo} - ${item.descricao.substring(0, 60)}...</option>`;
        }
    });
    select.innerHTML = html;
};

window.carregarDadosServicoPrazo = function() {
    const codigo = document.getElementById('select-servico-prazo').value;
    const inputTurma = document.getElementById('input-turma-prazo');
    const inputProd = document.getElementById('input-prod-prazo');
    const inputEspera = document.getElementById('input-espera-prazo');
    
    const registro = window.appState.bancoPrazos.find(b => b.codigo === codigo);
    if (registro) {
        inputTurma.value = registro.turma || '';
        inputProd.value = registro.producaoDiaria || '';
        inputEspera.value = registro.espera || 0;
    } else {
        inputTurma.value = ''; inputProd.value = ''; inputEspera.value = '';
    }
};

window.salvarNoBancoPrazos = function() {
    const codigo = document.getElementById('select-servico-prazo').value;
    if (!codigo) return alert("Selecione um serviço primeiro.");
    
    const turma = document.getElementById('input-turma-prazo').value;
    const prod = parseFloat(document.getElementById('input-prod-prazo').value);
    const espera = parseInt(document.getElementById('input-espera-prazo').value) || 0;

    if (!prod || prod <= 0) return alert("Insira uma produção diária válida (maior que zero).");

    let registro = window.appState.bancoPrazos.find(b => b.codigo === codigo);
    if (registro) {
        registro.turma = turma; registro.producaoDiaria = prod; registro.espera = espera;
    } else {
        window.appState.bancoPrazos.push({ codigo: codigo, turma: turma, producaoDiaria: prod, espera: espera });
    }

    let atualizados = 0;
    window.appState.orcamento.forEach(item => {
        if (item.codigo === codigo && parseFloat(item.qtd) > 0) {
            if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', espera: 0 };
            
            let diasNecessarios = Math.ceil(parseFloat(item.qtd) / prod);
            item.cronograma.hh = diasNecessarios * 8; 
            item.cronograma.equipe = 1; 
            item.cronograma.espera = espera;
            
            atualizados++;
        }
    });

    alert(`✅ Registrado! Duração calculada e atualizada para ${atualizados} itens no cronograma.`);
    window.carregarTabelaCronograma();
    window.gerarGraficoGantt();
};

window.exportarBancoPrazos = function() {
    window.downloadArquivo(JSON.stringify(window.appState.bancoPrazos, null, 2), "banco_prazos.json", "application/json");
};

window.importarBancoPrazos = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            window.appState.bancoPrazos = JSON.parse(e.target.result);
            alert("📂 Banco de Prazos carregado com sucesso!");
        } catch (err) { alert("Erro ao ler o ficheiro."); }
        event.target.value = '';
    };
    reader.readAsText(file);
};