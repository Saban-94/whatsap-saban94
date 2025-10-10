const SS_ID = "146dXlaWJrYLcUiAhRCv3lCYrJuNDYGBOHkL86jgyvLI";
const DRIVE_FOLDER_ID = "1AWl10eAyTLOzNSp3LibtScDeH_SQKNZj";

/**
 * NEW: Version endpoint for debugging deployments.
 * When you access the script's URL directly in a browser, this function runs.
 */
function doGet(e) {
  const versionInfo = {
    status: "ok",
    version: "5.0", // Manually update this version number with each new deployment
    deploymentTime: new Date().toISOString(),
    scriptId: ScriptApp.getScriptId()
  };
  return ContentService.createTextOutput(JSON.stringify(versionInfo))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Main function to handle POST requests from the web app.
 * This acts as a router, directing the request to the correct function based on the 'action' parameter.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    Logger.log(`doPost received action: '${body.action || 'NO_ACTION_SPECIFIED'}' from client ID: ${body.clientId || 'N/A'}`);
    let result;

    switch (body.action) {
      case 'getDashboardData':
        result = getDashboardData(body.clientId);
        break;
      case 'createOrderFromText':
        result = createOrderFromText(body.text, body.clientId, body.confirmed);
        break;
      case 'createFreeFormOrder':
        result = createFreeFormOrder(body.orderData, body.clientId);
        break;
      case 'processChatMessage':
        result = processChatMessage(body.text, body.clientId);
        break;
      case 'diagnoseSystem':
        result = diagnoseSystem();
        break;
      default:
        throw new Error(`פעולה לא מוכרת: ${body.action}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`Error in doPost: ${error.toString()}\nStacktrace: ${error.stack}`);
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: `שגיאת שרת: ${error.message}` 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Main function to handle all incoming chat messages.
 */
function processChatMessage(text, clientId) {
  try {
    logChatMessage(clientId, 'לקוח', text);
    const analysisResult = analyzeMessage(text, clientId);
    if (analysisResult.success && analysisResult.data.orderPreview) {
      return analysisResult;
    }

    const qnaSheet = getSheetDataAsObjects('שאלות ותשובות');
    const lowerText = text.toLowerCase();
    
    let responseTemplate = '';
    for (const row of qnaSheet) {
      const keyword = row['מילת מפתח'] ? row['מילת מפתח'].toLowerCase() : '';
      if (keyword && lowerText.includes(keyword)) {
        responseTemplate = row['תבנית תגובה'];
        break;
      }
    }

    if (responseTemplate) {
      let finalResponse = responseTemplate;
      const clientData = getClientData(clientId);
      const lastOrder = getLastOrder(clientId);

      finalResponse = finalResponse.replace(/{client_name}/g, clientData.name || 'לקוח');
      if(lastOrder) {
        finalResponse = finalResponse.replace(/{order_id}/g, `<b>${lastOrder.id || 'לא זמין'}</b>`);
        finalResponse = finalResponse.replace(/{order_status}/g, `<b>${lastOrder.status || 'לא זמין'}</b>`);
        finalResponse = finalResponse.replace(/{order_link}/g, lastOrder.link || '#');
      }
      
      logChatMessage(clientId, 'בוט', finalResponse);
      return { success: true, data: { html: finalResponse } };
    }

    const defaultResponse = getDefaultResponse(text);
    logChatMessage(clientId, 'בוט', defaultResponse);
    return { success: true, data: { html: defaultResponse } };

  } catch (error) {
    Logger.log(`Error in processChatMessage: ${error.toString()}`);
    return { success: false, error: error.message };
  }
}


// --- HELPER FUNCTIONS ---

function getClientData(clientId) {
    const clients = getSheetDataAsObjects("לקוחות");
    const client = clients.find(c => (c['מזהה_לקוח'] || '').toString() === clientId.toString());
    return {
        name: client ? client['שם_מלא'] : 'לקוח',
        avatar: client ? client['תמונת_פרופיל'] : 'https://i.postimg.cc/tCpLp7B6/image.png'
    };
}

function getLastOrder(clientId) {
  const allOrdersRaw = [
    ...getSheetDataAsObjects("הזמנות מכולות"),
    ...getSheetDataAsObjects("הזמנות חומרי בנין"),
  ];
  
  const clientOrders = allOrdersRaw.filter(o => o['מספר לקוח'] && o['מספר לקוח'].toString() === clientId.toString());
  
  if (clientOrders.length === 0) return null;

  clientOrders.sort((a, b) => {
    const dateA = new Date(a['תאריך התחלה'] || a['תאריך קליטה'] || 0);
    const dateB = new Date(b['תאריך התחלה'] || b['תאריך קליטה'] || 0);
    return dateB - dateA;
  });

  const latestOrderRaw = clientOrders[0];

  return {
    id: latestOrderRaw['מספר_הזמנה'] || 'N/A',
    status: latestOrderRaw['סטטוס'] || 'לא ידוע',
    link: latestOrderRaw['קישור_הזמנה'] || '#'
  };
}

function logChatMessage(clientId, sender, message) {
  try {
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName('לוג צ\'אט');
    if (sheet) {
      const cleanMessage = message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      sheet.appendRow([new Date(), clientId, sender, cleanMessage]);
    }
  } catch(e) {
    Logger.log("Error logging chat message: " + e.toString());
  }
}

function getSheetDataAsObjects(sheetName) {
    try {
        const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(sheetName);
        if (!sheet) {
            if (['לקוחות', 'הזמנות חומרי בנין', 'הזמנות מכולות', 'שאלות ותשובות', 'לוג צ\'אט', 'הגדרות'].includes(sheetName)) {
                createMissingSheets();
                return getSheetDataAsObjects(sheetName);
            }
            return [];
        }
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];
        const headers = data.shift().map(h => h.trim());
        return data.map(row => {
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = row[i];
            });
            return obj;
        });
    } catch (error) {
        Logger.log(`Error in getSheetDataAsObjects for ${sheetName}: ${error}`);
        return [];
    }
}

function createMissingSheets() {
    const spreadsheet = SpreadsheetApp.openById(SS_ID);
    const requiredSheets = {
        "לקוחות": ["מזהה_לקוח", "שם_מלא", "כתובת", "טלפון", "תמונת_פרופיל"],
        "הזמנות מכולות": ["מספר_הזמנה", "מספר לקוח", "שם פרויקט", "סטטוס", "כתובת", "lat", "lon", "תאריך התחלה"],
        "הזמנות חומרי בנין": ["מספר_הזמנה", "מספר לקוח", "שם פרויקט", "סטטוס", "פריטים", "כתובת", "lat", "lon", "קישור_הזמנה", "תאריך קליטה"],
        "שאלות ותשובות": ["מילת מפתח", "תבנית תגובה"],
        "לוג צ'אט": ["תאריך", "מזהה לקוח", "שולח", "הודעה"],
        "הגדרות": ["Key", "Value"]
    };
    for (const [sheetName, headers] of Object.entries(requiredSheets)) {
        if (!spreadsheet.getSheetByName(sheetName)) {
            const sheet = spreadsheet.insertSheet(sheetName);
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            Logger.log(`Created sheet: ${sheetName}`);
        }
    }
}


function getDashboardData(clientId) {
    try {
        const clientInfo = getClientData(clientId);
        if (!clientInfo || !clientInfo.name) return { success: false, error: "לקוח לא נמצא." };

        const containers = getSheetDataAsObjects("הזמנות מכולות").filter(o => o['מספר לקוח'] && o['מספר לקוח'].toString() === clientId.toString());
        const materials = getSheetDataAsObjects("הזמנות חומרי בנין").filter(o => o['מספר לקוח'] && o['מספר לקוח'].toString() === clientId.toString());
        
        const allOrders = [...containers.map(o => ({...o, type: 'container'})), ...materials.map(o => ({...o, type: 'material'}))];

        const mappedOrders = allOrders.map(o => ({
            id: o['מספר_הזמנה'],
            project: o['שם פרויקט'],
            status: o.סטטוס,
            items: o.פריטים || 'מכולה',
            address: o.כתובת,
            lat: o.lat,
            lon: o.lon,
            type: o.type,
            startDate: o['תאריך התחלה'] || o['תאריך קליטה']
        }));

        mappedOrders.sort((a,b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));

        return { 
            success: true, 
            data: { 
                client: { id: clientId, name: clientInfo.name, avatar: clientInfo.avatar },
                dashboard: { 
                    orders: mappedOrders,
                    stats: { 
                        total: allOrders.length, 
                        active: allOrders.filter(o=>o.סטטוס==='פעיל').length, 
                        pending: allOrders.filter(o=>o.סטטוס==='ממתין' || o.סטטוס==='חדשה').length 
                    }
                }
            } 
        };
    } catch (error) {
        Logger.log('Error in getDashboardData: ' + error.toString());
        return { success: false, error: 'שגיאה בטעינת נתונים: ' + error.message };
    }
}

function getNextOrderId(typePrefix, key) {
  const settingsSheet = SpreadsheetApp.openById(SS_ID).getSheetByName('הגדרות');
  if (!settingsSheet) {
    createMissingSheets(); // Ensure settings sheet exists
    const newSheet = SpreadsheetApp.openById(SS_ID).getSheetByName('הגדרות');
    newSheet.appendRow([key, 1]);
    return `SBN-${typePrefix}-0001`;
  }
  const data = settingsSheet.getDataRange().getValues();
  let lastId = 0;
  let keyRowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      lastId = parseInt(data[i][1]) || 0;
      keyRowIndex = i + 1;
      break;
    }
  }

  const newId = lastId + 1;

  if (keyRowIndex !== -1) {
    settingsSheet.getRange(keyRowIndex, 2).setValue(newId);
  } else {
    settingsSheet.appendRow([key, newId]);
  }

  const formattedId = "0000".substring(0, 4 - newId.toString().length) + newId;
  return `SBN-${typePrefix}-${formattedId}`;
}


function createFreeFormOrder(orderData, clientId) {
  try {
    const orderId = getNextOrderId('MAT', 'last_mat_id');
    const latLon = geocodeAddress(orderData.deliveryAddress);
    
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות חומרי בנין");
    const newOrder = [
        orderId, clientId, orderData.projectName, 'חדשה', orderData.products,
        orderData.deliveryAddress, latLon.lat, latLon.lon, '', new Date()
    ];
    sheet.appendRow(newOrder);
    
    // Create and share a file
    const fileContent = `הזמנה: ${orderId}\nלקוח: ${clientId}\nפרויקט: ${orderData.projectName}\nכתובת: ${orderData.deliveryAddress}\nמוצרים:\n${orderData.products}`;
    const blob = Utilities.newBlob(fileContent, 'text/plain', `הזמנה_${orderId}.txt`);
    const driveFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const file = driveFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const googleDriveLink = file.getUrl();

    sheet.getRange(sheet.getLastRow(), 9).setValue(googleDriveLink);

    return { success: true, data: { orderId, googleDriveLink } };
  } catch(e) {
    Logger.log("Error in createFreeFormOrder: " + e.toString());
    return { success: false, error: e.message };
  }
}

function geocodeAddress(address) {
    if (typeof Maps === 'undefined') {
        Logger.log("Warning: Google Maps service is not enabled. Geocoding will be skipped.");
        return { lat: null, lon: null };
    }
    try {
        const response = Maps.newGeocoder().geocode(address);
        if (response.status === 'OK' && response.results.length > 0) {
            const location = response.results[0].geometry.location;
            return { lat: location.lat, lon: location.lng };
        }
        return { lat: null, lon: null };
    } catch (e) {
        Logger.log(`Geocoding error for address "${address}": ${e.toString()}`);
        return { lat: null, lon: null };
    }
}


// --- DUMMY & TEST FUNCTIONS ---
function createOrderFromText(text, clientId, confirmed) { 
  try {
    const orderId = getNextOrderId('MAT', 'last_mat_id');
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות חומרי בנין");
    sheet.appendRow([orderId, clientId, "הזמנה מהצ'אט", "חדשה", text, "", "", "", "", new Date()]);
    return { success: true, data: { orderId }}; 
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function uploadFile(payload) { return { success: true, data: { viewUrl: '#' } }; }
function updateClientAddress(clientId, lat, lon) { return { success: true }; }
function diagnoseSystem() { return { success: true }; }
function getDefaultResponse(text) { return "לא הצלחתי להבין את הבקשה. תוכל לנסח אותה מחדש או לפנות לנציג?"; }

