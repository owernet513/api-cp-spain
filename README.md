# Consulta de Códigos Postales en Google Spreadsheets

Este repositorio contiene un script desarrollado en **Google Apps Script** que permite consultar información asociada a **códigos postales españoles** directamente desde **Google Spreadsheets**.

El funcionamiento es simple: introduces un código postal en la hoja y el script consulta la **API de Correos**, rellenando automáticamente la información correspondiente.

---

## 📮 Información que devuelve

Para cada código postal válido, el script obtiene:

- Población
- Municipio
- Provincia
- Comunidad
- País

Los datos se escriben directamente en la hoja de cálculo.

---

## ⚙️ Cómo funciona

- El script lee los códigos postales desde una hoja concreta.
- Procesa los datos **por lotes**, evitando errores por tiempo de ejecución.
- Guarda el progreso para continuar donde se quedó.
- Puede ejecutarse:
  - Manualmente desde un menú personalizado
  - Automáticamente mediante **triggers temporales**

---

## 🛠️ Tecnologías utilizadas

- Google Apps Script
- JavaScript
- API pública de Correos (España)

---

## 📋 Requisitos

- Google Spreadsheets
- Cuenta de Google
- Permisos para ejecutar Apps Script

---

## 📑 Estructura esperada de la hoja

- **Columna A**: Código Postal
- **Columnas B–F**: Información devuelta por la API

El nombre de la hoja y otros parámetros se pueden modificar desde las constantes del script.

---

## 🔁 Procesamiento por lotes

Para evitar los límites de ejecución de Google:

- Los códigos postales se procesan en bloques configurables
- El estado del proceso se guarda automáticamente
- Puede reiniciarse en cualquier momento desde el menú

---

## ⏱️ Ejecución automática

El script permite crear un **trigger** que ejecuta el proceso de forma periódica (por ejemplo, cada minuto), ideal para hojas con muchos códigos postales.

---

## 🔧 Configuración inicial

Antes de usar el script, revisa las constantes:

```javascript
const SPREADSHEET_ID = 'TU_ID_DE_SPREADSHEET';
const TAMANO_LOTE = 10;
const NOMBRE_HOJA = 'CP';
const MODO_DEBUG = true;
