  // =================================================================
// CONFIGURACIÓN GLOBAL
// =================================================================

// **¡IMPORTANTE!** Pega aquí el ID de tu hoja de cálculo para que los triggers funcionen.
// Lo encuentras en la URL de tu Google Sheet (entre /d/ y /edit/).
const SPREADSHEET_ID = '11MIBzDUhKj4F6tOV_0Y5BYGyj4htMLPKJ4cl9wpI9g0';

// Define cuántos códigos postales se procesarán en cada lote/ejecución.
// Un valor entre 20 y 50 es seguro.
const TAMANO_LOTE = 10; 

// Nombre de la hoja de cálculo donde están los datos.
const NOMBRE_HOJA = 'CP';

// MODO DEPURACIÓN (DEBUG)
// Ponlo en 'true' para ver registros detallados en la sección "Ejecuciones".
// Ponlo en 'false' para el funcionamiento normal y silencioso.
const MODO_DEBUG = true;


// =================================================================
// LÓGICA PRINCIPAL (MODIFICADA PARA FUNCIONAR CON TRIGGERS)
// =================================================================

/**
 * Función principal que procesa UN LOTE de códigos postales.
 * Se ejecuta desde el menú o de forma automática con un trigger.
 */
function procesarLoteDeCodigos() {
  log('--- INICIANDO procesarLoteDeCodigos ---');
  // Se elimina la llamada a SpreadsheetApp.getUi() de aquí, ya que falla en los triggers.
  
  try {
    // CAMBIO: Usamos openById() para que el trigger (cron) sepa exactamente qué archivo abrir.
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = spreadsheet.getSheetByName(NOMBRE_HOJA);
    
    if (!hoja) {
      // CAMBIO: Si la hoja no se encuentra, lo registramos en el log en lugar de mostrar una alerta.
      log('ERROR CRÍTICO: No se encontró la hoja "' + NOMBRE_HOJA + '". Revisa las constantes SPREADSHEET_ID y NOMBRE_HOJA.');
      return;
    }
    
    const datos = hoja.getDataRange().getValues();
    const ultimaFilaTotal = hoja.getLastRow();
    
    const scriptProperties = PropertiesService.getScriptProperties();
    let ultimaFilaProcesada = parseInt(scriptProperties.getProperty('ultimaFilaProcesada') || '1'); 
    log(`Fila de inicio para esta ejecución: ${ultimaFilaProcesada}`);

    if (ultimaFilaProcesada >= ultimaFilaTotal && ultimaFilaTotal > 1) {
      log('Proceso ya completado. Reiniciando contador para la próxima vez.');
      reiniciarProceso(false); // Reinicia sin mostrar alerta, ya que puede ser una ejecución automática.
      return;
    }
    
    const loteAConsultar = [];
    const mapeoFilaLote = {}; 
    let filaIndice = ultimaFilaProcesada;

    for (let i = ultimaFilaProcesada; i < datos.length; i++) {
      filaIndice = i + 1;
      const codigoPostal = datos[i][0];
      const infoExistente = datos[i][1];

      if (codigoPostal && codigoPostal.toString().trim() !== '' && (!infoExistente || infoExistente.toString().trim() === '')) {
        let cpLimpio = codigoPostal.toString().trim().padStart(5, '0');
        if (/^\d{5}$/.test(cpLimpio)) {
          loteAConsultar.push(cpLimpio);
          mapeoFilaLote[cpLimpio] = filaIndice; 
        }
      }
      if (loteAConsultar.length >= TAMANO_LOTE) break;
    }
    
    ultimaFilaProcesada = filaIndice;

    if (loteAConsultar.length === 0) {
      log('No se encontraron nuevos CPs para procesar en este rango. Marcando como finalizado.');
      scriptProperties.setProperty('ultimaFilaProcesada', ultimaFilaTotal);
      return;
    }
    
    log(`Lote a consultar (${loteAConsultar.length} CPs): [${loteAConsultar.join(',')}]`);
    
    const resultadosAPI = consultarAPILote(loteAConsultar);
    
    if (resultadosAPI) {
      log('Resultados recibidos de la API. Actualizando hoja.');
      let procesados = 0;
      for (const cp in resultadosAPI) {
        if (mapeoFilaLote[cp]) {
          const fila = mapeoFilaLote[cp];
          const info = resultadosAPI[cp];
          hoja.getRange(fila, 2, 1, 5).setValues([[
            info.poblacion, info.municipio, info.provincia, info.comunidad, info.pais
          ]]);
          procesados++;
        }
      }
      log(`Se actualizaron ${procesados} filas.`);
    }

    scriptProperties.setProperty('ultimaFilaProcesada', ultimaFilaProcesada);
    log(`Progreso guardado. Próxima ejecución desde fila: ${ultimaFilaProcesada}`);
    SpreadsheetApp.flush(); // Asegura que los cambios se guarden antes de que termine la ejecución.
  } catch (error) {
    log(`--- ERROR CATASTRÓFICO: ${error.message} --- \n ${error.stack}`);
  }
  log('--- FIN de la ejecución ---');
}

/**
 * Consulta la API de Correos con un lote de códigos postales.
 */
function consultarAPILote(codigosPostales) {
  if (!codigosPostales || codigosPostales.length === 0) return null;
  
  const textoConsulta = codigosPostales.join(',');
  const url = `https://api1.correos.es/digital-services/searchengines/api/v1/suggestions?text=${encodeURIComponent(textoConsulta)}`;
  log(`URL consultada: ${url}`);
  
  try {
    const respuesta = UrlFetchApp.fetch(url, { 'muteHttpExceptions': true });
    const responseCode = respuesta.getResponseCode();
    
    if (responseCode === 200) {
      const datosJSON = JSON.parse(respuesta.getContentText());
      const resultados = {};
      
      if (datosJSON.suggestions && datosJSON.suggestions.length > 0) {
        log(`API devolvió ${datosJSON.suggestions.length} sugerencias.`);
        for (const suggestion of datosJSON.suggestions) {
          const partes = suggestion.text.split(',').map(p => p.trim());
          if (partes.length >= 4) {
            resultados[partes[0]] = {
              poblacion: partes[1] || '', municipio: partes[2] || '', provincia: partes[3] || '',
              comunidad: partes[3] || '', pais: partes[partes.length - 1] || ''
            };
          }
        }
        return resultados;
      } else {
         log(`API devolvió 200 OK pero sin sugerencias para: [${textoConsulta}]`);
         return {}; // Devuelve un objeto vacío para no romper el bucle.
      }
    } else {
      log(`ERROR en API. Código: ${responseCode}. Respuesta: ${respuesta.getContentText()}`);
      return null;
    }
  } catch (error) {
    log(`--- ERROR CATASTRÓFICO en consultarAPILote: ${error.message} ---`);
    return null;
  }
}


// =================================================================
// FUNCIONES AUXILIARES, DE MENÚ Y TRIGGERS (NO REQUIEREN CAMBIOS)
// =================================================================

/**
 * Función de registro condicional. Solo escribe en los logs si MODO_DEBUG es true.
 * @param {string} message El mensaje a registrar.
 */
function log(message) {
  if (MODO_DEBUG) {
    Logger.log(message);
  }
}

/**
 * Crea el menú personalizado en la hoja de cálculo al abrirla.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📮 Correos Lotes')
    .addItem('➡️ Procesar Siguiente Lote', 'procesarLoteDeCodigos')
    .addSeparator()
    .addItem('🔁 Reiniciar Proceso Completo', 'reiniciarProcesoConAlerta')
    .addSeparator()
    .addItem('⚙️ Crear Trigger Automático (cada minuto)', 'crearTriggerCadaMinuto')
    .addItem('🗑️ Eliminar Todos los Triggers', 'eliminarTriggers')
    .addToUi();
}

/**
 * Wrapper para el menú, para que siempre muestre la alerta al reiniciar.
 */
function reiniciarProcesoConAlerta() {
  reiniciarProceso(true);
}

/**
 * Resetea el contador del proceso para que comience desde el principio.
 * @param {boolean} mostrarAlerta - Si es true, muestra un pop-up de confirmación.
 */
function reiniciarProceso(mostrarAlerta = true) {
  try {
    PropertiesService.getScriptProperties().deleteProperty('ultimaFilaProcesada');
    if (mostrarAlerta) {
      // Esta parte solo se ejecuta si se llama desde el menú, lo cual es correcto.
      SpreadsheetApp.getUi().alert('Proceso Reiniciado', 'El contador se ha limpiado. La próxima ejecución comenzará desde la primera fila.', SpreadsheetApp.getUi().Button.OK);
    }
    log('El estado del proceso ha sido reiniciado.');
  } catch (e) {
    log('Error al reiniciar el proceso: ' + e.message);
  }
}

/**
 * Configura un activador (trigger) para ejecutar el proceso automáticamente.
 */
function crearTriggerCadaMinuto() {
  eliminarTriggers(); // Evita duplicados
  ScriptApp.newTrigger('procesarLoteDeCodigos')
    .timeBased()
    .everyMinutes(1)
    .create();
  SpreadsheetApp.getUi().alert('Trigger Creado', 'Se ha configurado un activador para ejecutar el proceso cada minuto.', SpreadsheetApp.getUi().Button.OK);
  log('Trigger de 1 minuto creado para la función "procesarLoteDeCodigos".');
}

/**
 * Elimina todos los triggers asociados a la función principal de este script.
 */
function eliminarTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let eliminados = 0;
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'procesarLoteDeCodigos') {
      ScriptApp.deleteTrigger(trigger);
      eliminados++;
    }
  }
  if (eliminados > 0) {
    SpreadsheetApp.getUi().alert(`${eliminados} trigger(s) eliminado(s).`);
    log(`Se eliminaron ${eliminados} triggers.`);
  } else {
    SpreadsheetApp.getUi().alert(`No se encontraron triggers para eliminar.`);
  }
}
