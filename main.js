// Configurações
const CONFIG = {
    whatsappNumber: '5511912109424',
    whatsappBaseUrl: 'https://wa.me/'
};

// Estado da aplicação
let pedidosCount = 0;

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

// Inicializa a aplicação
function initializeApp() {
    updatePedidosCount();
    setupEventListeners();
    checkPDFFile();
}

// Configura os event listeners
function setupEventListeners() {
    // Fechar popup com ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closePedidosBox();
        }
    });

    // Auto-resize do textarea
    const textarea = document.getElementById('pedidosText');
    if (textarea) {
        textarea.addEventListener('input', autoResizeTextarea);
    }

    // Contador de caracteres no textarea
    textarea.addEventListener('input', updatePedidosCount);
}

// Verifica se existe arquivo PDF e o carrega
function checkPDFFile() {
    const pdfContainer = document.querySelector('.pdf-container');
    const placeholder = document.querySelector('.pdf-placeholder');

    // Lista de nomes possíveis para o arquivo PDF (incluindo o arquivo específico)
    const possiblePDFNames = ['RBS-2025.pdf', 'catalogo.pdf', 'catalog.pdf', 'produto.pdf', 'produtos.pdf'];

    // Tenta carregar o primeiro PDF encontrado
    tryLoadPDF(possiblePDFNames, 0, pdfContainer, placeholder);
}

// Tenta carregar o PDF
function tryLoadPDF(pdfNames, index, container, placeholder) {
    if (index >= pdfNames.length) {
        return; // Nenhum PDF encontrado
    }

    const pdfName = pdfNames[index];
    const testImg = new Image();

    // Testa se o arquivo existe
    fetch(pdfName, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                loadPDFViewer(pdfName, container, placeholder);
            } else {
                tryLoadPDF(pdfNames, index + 1, container, placeholder);
            }
        })
        .catch(() => {
            tryLoadPDF(pdfNames, index + 1, container, placeholder);
        });
}

// Carrega o visualizador de PDF
function loadPDFViewer(pdfPath, container, placeholder) {
    const embed = document.createElement('embed');
    embed.src = pdfPath;
    embed.type = 'application/pdf';
    embed.width = '100%';
    embed.height = '100%';
    embed.style.border = 'none';
    embed.style.display = 'block';

    // Remove o placeholder e adiciona o PDF
    placeholder.style.display = 'none';
    container.appendChild(embed);

    console.log('📄 PDF carregado com sucesso:', pdfPath);
}

// Abre o WhatsApp
function openWhatsApp(customMessage = '') {
    const message = customMessage || 'Olá! Vim através do catálogo digital e gostaria de mais informações.';
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `${CONFIG.whatsappBaseUrl}${CONFIG.whatsappNumber}?text=${encodedMessage}`;

    // Abre em nova aba
    window.open(whatsappUrl, '_blank');
}

// Toggle da caixa de pedidos
function togglePedidosBox() {
    const popup = document.getElementById('pedidosPopup');
    if (popup.classList.contains('active')) {
        closePedidosBox();
    } else {
        openPedidosBox();
    }
}

// Abre a caixa de pedidos
function openPedidosBox() {
    const popup = document.getElementById('pedidosPopup');
    const textarea = document.getElementById('pedidosText');

    popup.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Foca no textarea após a animação
    setTimeout(() => {
        textarea.focus();
    }, 300);
}

// Fecha a caixa de pedidos
function closePedidosBox() {
    const popup = document.getElementById('pedidosPopup');
    popup.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Limpa os pedidos
function clearPedidos() {
    const textarea = document.getElementById('pedidosText');

    if (textarea.value.trim() === '') {
        showModal('Não há pedidos para limpar.', 'info');
        return;
    }

    // Usar modal de confirmação ao invés de confirm()
    showConfirmModal(
        'Tem certeza que deseja limpar todos os pedidos?',
        'Confirmação',
        function () {
            textarea.value = '';
            updatePedidosCount();
            textarea.focus();
            showModal('Pedidos limpos com sucesso!', 'success');
        }
    );
}

// Envia pedidos via WhatsApp
function enviarPedidos() {
    const textarea = document.getElementById('pedidosText');
    const pedidosText = textarea.value.trim();

    if (pedidosText === '') {
        showModal('Por favor, digite seus pedidos antes de enviar.', 'warning');
        textarea.focus();
        return;
    }

    // Formata a mensagem
    const mensagemFormatada = formatarMensagemPedido(pedidosText);

    // Fecha o popup
    closePedidosBox();

    // Envia via WhatsApp
    openWhatsApp(mensagemFormatada);

    // Feedback usando modal
    showModal('Pedido enviado para o WhatsApp! Você será redirecionado automaticamente.', 'success');

    // Limpeza opcional usando modal
    setTimeout(() => {
        showConfirmModal(
            'Pedido enviado! Deseja limpar a lista de pedidos?',
            'Limpeza Opcional',
            function () {
                textarea.value = '';
                updatePedidosCount();
            }
        );
    }, 1000);
}

// Formata a mensagem do pedido (SEM EMOJIS para WhatsApp Web)
function formatarMensagemPedido(pedidos) {
    const dataHora = new Date().toLocaleString('pt-BR');
    let mensagem = `NOVO PEDIDO - ${dataHora}\n\n`;
    mensagem += `Detalhes do Pedido:\n`;
    mensagem += `${pedidos}\n\n`;
    mensagem += `Enviado através do catálogo digital\n`;
    mensagem += `Aguardo confirmação e informações sobre entrega/retirada.`;
    return mensagem;
}

// Atualiza o contador de pedidos
function updatePedidosCount() {
    const textarea = document.getElementById('pedidosText');
    const countElement = document.getElementById('pedidosCount');

    if (!textarea || !countElement) return;

    const text = textarea.value.trim();
    const lines = text === '' ? 0 : text.split('\n').filter(line => line.trim() !== '').length;

    pedidosCount = lines;
    countElement.textContent = pedidosCount;

    // Atualiza a cor baseada na quantidade (mantendo o preto como base)
    const pedidosBox = document.querySelector('.pedidos-box');
    if (pedidosCount === 0) {
        pedidosBox.style.background = '#343a40'; // Cinza escuro
        pedidosBox.style.boxShadow = '0 6px 20px rgba(52, 58, 64, 0.4)';
    } else if (pedidosCount < 5) {
        pedidosBox.style.background = '#495057'; // Cinza médio
        pedidosBox.style.boxShadow = '0 6px 20px rgba(73, 80, 87, 0.4)';
    } else {
        pedidosBox.style.background = '#6c757d'; // Cinza claro
        pedidosBox.style.boxShadow = '0 6px 20px rgba(108, 117, 125, 0.4)';
    }
}

// Auto-resize do textarea
function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
}

// Modal unificado para feedback
function showModal(message, type = 'info') {
    const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    const modalBody = document.getElementById('feedbackModalBody');
    const modalTitle = document.getElementById('feedbackModalLabel');

    // Configurar ícones e cores baseados no tipo
    let icon, titleText, alertClass;

    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            titleText = 'Sucesso';
            alertClass = 'alert-success';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            titleText = 'Atenção';
            alertClass = 'alert-warning';
            break;
        case 'error':
            icon = 'fas fa-times-circle';
            titleText = 'Erro';
            alertClass = 'alert-danger';
            break;
        default:
            icon = 'fas fa-info-circle';
            titleText = 'Informação';
            alertClass = 'alert-info';
    }

    modalTitle.innerHTML = `<i class="${icon}"></i> ${titleText}`;
    modalBody.innerHTML = `<div class="alert ${alertClass} mb-0">${message}</div>`;

    modal.show();
}

// Funções utilitárias para desenvolvimento
function debugInfo() {
    console.log('📱 Catálogo Digital - Informações de Debug:');
    console.log('WhatsApp:', CONFIG.whatsappNumber);
    console.log('Pedidos Count:', pedidosCount);
    console.log('PDF Container:', document.querySelector('.pdf-container'));
    console.log('Popup Status:', document.getElementById('pedidosPopup').classList.contains('active'));
}

// Detecta dispositivo mobile
function isMobile() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Adiciona classe para mobile
if (isMobile()) {
    document.body.classList.add('mobile-device');
}

// Função para testar WhatsApp (desenvolvimento)
function testWhatsApp() {
    openWhatsApp('Teste de conexão do catálogo digital');
}

// Expõe funções para debug (apenas em desenvolvimento)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugCatalogo = {
        debugInfo,
        testWhatsApp,
        showModal,
        showConfirmModal,
        config: CONFIG
    };
    console.log('🔧 Modo de desenvolvimento ativado. Use window.debugCatalogo para debug.');
}