document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Pads
    const canvasArrendador = document.getElementById('pad-arrendador');
    const canvasArrendatario = document.getElementById('pad-arrendatario');
    
    // Función para manejar responsividad del canvas (sharp on retina displays)
    function resizeCanvas(canvas) {
        const ratio =  Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
    }

    resizeCanvas(canvasArrendador);
    resizeCanvas(canvasArrendatario);
    
    window.addEventListener("resize", () => {
        // Solo redimensionar si están vacíos para no perder firma en resize repentino
        // idealmente se guardaria y restauraria
    });

    const signaturePadArrendador = new SignaturePad(canvasArrendador, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'rgb(0, 0, 0)'
    });
    
    const signaturePadArrendatario = new SignaturePad(canvasArrendatario, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'rgb(0, 0, 0)'
    });

    // Desperfectos toggle
    const estadoInmueble = document.getElementById('estadoInmueble');
    const desperfectosList = document.getElementById('desperfectosList');
    const labelDesperfectos = document.getElementById('labelDesperfectos');

    estadoInmueble.addEventListener('change', (e) => {
        if (e.target.value === 'desperfectos') {
            desperfectosList.disabled = false;
            labelDesperfectos.classList.remove('disabled-label');
            desperfectosList.required = true;
        } else {
            desperfectosList.disabled = true;
            labelDesperfectos.classList.add('disabled-label');
            desperfectosList.value = '';
            desperfectosList.required = false;
        }
    });

    // Botones limpiar firmas
    document.getElementById('clear-arrendador').addEventListener('click', () => signaturePadArrendador.clear());
    document.getElementById('clear-arrendatario').addEventListener('click', () => signaturePadArrendatario.clear());

    const btnShare = document.getElementById('btn-share');
    const shareOptions = document.getElementById('share-options');
    const btnWhatsapp = document.getElementById('btn-whatsapp');
    const btnCopy = document.getElementById('btn-copy');
    const btnGeneratePdf = document.getElementById('btn-generate-pdf');
    const form = document.getElementById('contract-form');
    
    let generatedUrl = '';

    // ============================================
    // STATE MANAGEMENT: INIT OR LOAD FROM URL
    // ============================================
    const hash = window.location.hash;
    let isLoadPhase = false;

    if (hash && hash.startsWith('#data=')) {
        // FASE 2: Recibe enlace el inquilino
        isLoadPhase = true;
        loadStateFromHash(hash.replace('#data=', ''));
        setupPhase2();
    } else {
        // FASE 1: Arrendador inicia
        signaturePadArrendatario.off(); // Bloquear
        // Autofill today's date
        document.getElementById('fechaRescision').valueAsDate = new Date();
    }

    // ============================================
    // PHASE 1: GENERATE SHARE LINK
    // ============================================
    btnShare.addEventListener('click', () => {
        // En lugar de bloquear nativo, damos un aviso si falta algo pero dejamos continuar
        if (!form.checkValidity()) {
            console.warn("Faltan algunos campos, pero permitimos continuar.");
        }

        if (signaturePadArrendador.isEmpty()) {
            alert('Por favor, el arrendador debe dibujar su firma antes de generar el enlace.');
            return;
        }

        try {
            // Serializar form
            const formData = new FormData(form);
            const dataObj = Object.fromEntries(formData.entries());
            
            // Serializar firma del arrendador
            dataObj.signature1 = signaturePadArrendador.toData();

            // Comprimir JSON con LZString
            const jsonStr = JSON.stringify(dataObj);
            const compressed = LZString.compressToEncodedURIComponent(jsonStr);
            
            // Crear URL Compartible
            const currentUrl = window.location.href.split('#')[0];
            generatedUrl = currentUrl + '#data=' + compressed;

            // Mostrar opciones de share
            btnShare.style.display = 'none';
            shareOptions.style.display = 'block';

            // Bloquear UI del arrendador
            lockFormInputs();
            signaturePadArrendador.off();
            document.getElementById('clear-arrendador').style.display = 'none';
            document.getElementById('signature1-locked-msg').style.display = 'block';
        } catch (error) {
            console.error("Error al generar enlace:", error);
            alert("Ocurrió un error al generar el código: " + error.message);
        }
    });

    btnWhatsapp.addEventListener('click', () => {
        const text = encodeURIComponent(`Hola, te envío el acuerdo de terminación de contrato para que lo revises y firmes. Por favor ábrelo aquí: ${generatedUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    });

    btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(generatedUrl).then(() => {
            alert('¡Enlace copiado al portapapeles!');
            btnCopy.textContent = "¡Copiado!";
            setTimeout(() => btnCopy.textContent = "Copiar Enlace", 2000);
        });
    });

    // ============================================
    // PHASE 2: SETUP & LOAD SHARED DATA
    // ============================================
    function loadStateFromHash(encodedData) {
        try {
            const jsonStr = LZString.decompressFromEncodedURIComponent(encodedData);
            const dataObj = JSON.parse(jsonStr);

            // Poblar inputs
            for (const key in dataObj) {
                if (key !== 'signature1') {
                    const el = document.getElementById(key);
                    if (el) {
                        el.value = dataObj[key];
                    }
                }
            }

            // Desperfectos check
            if (dataObj.estadoInmueble === 'desperfectos') {
                desperfectosList.disabled = false;
                labelDesperfectos.classList.remove('disabled-label');
            }

            // Restaurar firma 1
            if (dataObj.signature1) {
                // Hay que usar setTimeout para que el canvas renderice primero si es necesario
                setTimeout(() => {
                    signaturePadArrendador.fromData(dataObj.signature1);
                }, 50);
            }
        } catch (e) {
            console.error("No se pudo cargar la info de la URL", e);
            alert("El enlace parece ser inválido o corrupto.");
        }
    }

    function setupPhase2() {
        // UI Changes
        document.getElementById('mode-subtitle').textContent = "Revisa los términos estipulados y procede a firmar como Arrendatario.";
        btnShare.style.display = 'none';
        btnGeneratePdf.style.display = 'block';
        
        lockFormInputs();
        
        // Lock Pad 1
        signaturePadArrendador.off();
        document.getElementById('clear-arrendador').style.display = 'none';
        document.getElementById('signature1-locked-msg').style.display = 'block';
        
        // Active Pad 2
        document.getElementById('signature2-container').classList.remove('disabled-box');
        document.getElementById('help-arrendatario').style.display = 'none';
        document.getElementById('clear-arrendatario').style.display = 'inline-block';
        signaturePadArrendatario.on();
    }

    function lockFormInputs() {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = true);
    }

    // ============================================
    // PHASE 3: GENERATE PDF
    // ============================================
    btnGeneratePdf.addEventListener('click', () => {
        if (signaturePadArrendatario.isEmpty()) {
            alert('Por favor, firma antes de generar el PDF final.');
            return;
        }

        // Rellenar Plantilla PDF
        const populatePdf = (id, formId) => {
            const val = document.getElementById(formId).value;
            // formatear fecha si es necesario
            document.getElementById(id).textContent = val ? val : '---';
        };

        populatePdf('v-lugar', 'lugar');
        populatePdf('v-nombreArrendador', 'nombreArrendador');
        populatePdf('v-dniArrendador', 'dniArrendador');
        populatePdf('v-domicilioArrendador', 'domicilioArrendador');
        
        populatePdf('v-nombreArrendatario', 'nombreArrendatario');
        populatePdf('v-dniArrendatario', 'dniArrendatario');
        populatePdf('v-domicilioArrendatario', 'domicilioArrendatario');
        
        populatePdf('v-direccionInmueble', 'direccionInmueble');
        
        // Formateo de fechas para el texto
        const fOrig = document.getElementById('fechaOriginal').value;
        const fResc = document.getElementById('fechaRescision').value;
        document.getElementById('v-fechaOriginal').textContent = fOrig ? new Date(fOrig).toLocaleDateString('es-ES') : '---';
        document.getElementById('v-fechaRescision').textContent = fResc ? new Date(fResc).toLocaleDateString('es-ES') : '---';
        document.getElementById('v-fechaRescision2').textContent = fResc ? new Date(fResc).toLocaleDateString('es-ES') : '---';

        const est = document.getElementById('estadoInmueble').value;
        let estadoText = "en perfecto estado y a su entera satisfacción";
        if (est === 'desperfectos') {
            estadoText = `con los siguientes desperfectos: ${document.getElementById('desperfectosList').value}`;
        }
        document.getElementById('v-estadoInmuebleText').textContent = estadoText;

        populatePdf('v-fianzaMonto', 'fianzaMonto');
        populatePdf('v-extraComments', 'extraComments');
        if (!document.getElementById('extraComments').value) {
            document.getElementById('v-extraComments').textContent = "Ninguna.";
        }

        // Poner firmas (SVG/PNG to IMG src)
        document.getElementById('pdf-sign-arrendador').src = signaturePadArrendador.toDataURL();
        document.getElementById('pdf-sign-arrendatario').src = signaturePadArrendatario.toDataURL();

        // Extraer elemento HTML y usar html2pdf
        const element = document.getElementById('pdf-template');
        element.style.display = 'block'; // Mostrar temporalmente

        const opt = {
            margin:       15,
            filename:     'Terminacion_Alquiler.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Generar
        html2pdf().set(opt).from(element).save().then(() => {
            // Ocultar de nuevo
            element.style.display = 'none';
        });
    });
});
