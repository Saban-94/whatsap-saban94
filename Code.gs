const SS_ID = "146dXlaWJrYLcUiAhRCv3lCYrJuNDYGBOHkL86jgyvLI";
const DRIVE_FOLDER_ID = "1AWl10eAyTLOzNSp3LibtScDeH_SQKNZj";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let result;

    switch (body.action) {
      case 'getDashboardData': result = getDashboardData(body.clientId); break;
      case 'createOrderFromText': result = createOrderFromText(body.text, body.clientId); break;
      case 'uploadFile': result = uploadFile(body.payload); break;
      case 'updateClientAddress': result = updateClientAddress(body.clientId, body.lat, body.lon); break;
      default: throw new Error(`פעולה לא מוכרת: ${body.action}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(`Error in doPost: ${error.toString()}\nStacktrace: ${error.stack}`);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: `שגיאת שרת: ${error.message}` })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("The script is running and responds to POST requests.");
}

function getSheetDataAsObjects(sheetName) {
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Sheet "${sheetName}" not found.`);
      return [];
    }
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    if (!headers || headers.length === 0) {
       Logger.log(`Sheet "${sheetName}" has no headers.`);
      return [];
    }
    return data.map(row => headers.reduce((obj, header, i) => (obj[header.trim()] = row[i], obj), {}));
}

function getDashboardData(clientId) {
    const clientData = getSheetDataAsObjects("לקוחות").find(c => c['מזהה_לקוח'] && c['מזהה_לקוח'].toString() === clientId.toString());
    if (!clientData) return { success: false, error: "לקוח לא נמצא" };

    const allProjects = getSheetDataAsObjects("פרויקטים");

    const containers = getSheetDataAsObjects("הזמנות מכולות")
        .filter(o => o['מספר לקוח'] && o['מספר לקוח'].toString() === clientId.toString() && o.סטטוס !== 'סגור')
        .map(o => {
            // --- FIX: Logic to correctly find the project name and details ---
            const projectName = o['שם פרויקט'] || o['כתובת']; // Fallback to 'כתובת' if 'שם פרויקט' is missing
            const project = allProjects.find(p => p['שם_פרויקט'] === projectName);
            return { 
                type: 'container',
                id: o['מספר_הזמנה'] || `C${Math.random()}`,
                project: projectName || 'פרויקט לא משויך', 
                status: o.סטטוס, 
                items: `מכולה ${o['גודל'] || ''}`.trim(),
                startDate: o['תאריך התחלה'],
                address: project ? project.כתובת : (o.כתובת || 'לא צוינה'), // Use actual address from project
                lat: project ? project.lat : null,
                lon: project ? project.lon : null
            };
        });

    const materials = getSheetDataAsObjects("הזמנות חומרי בנין")
        .filter(o => o['מספר לקוח'] && o['מספר לקוח'].toString() === clientId.toString() && o.סטטוס !== 'סגור')
        .map(o => ({ 
            type: 'material',
            id: o['מספר_הזמנה'] || `M${Math.random()}`,
            project: o['שם פרויקט'] || 'פרויקט לא משויך', 
            status: o.סטטוס, 
            items: o['פריטים'] 
        }));
    
    const allOrders = [...containers, ...materials];

    return { 
        success: true, 
        data: { 
            client: { id: clientData['מזהה_לקוח'], name: clientData['שם_לקוח'], avatar: clientData['תמונת_פרופיל'] },
            dashboard: { orders: allOrders }
        } 
    };
}

function createOrderFromText(text, clientId) {
  const clientData = getSheetDataAsObjects("לקוחות").find(c => c['מזהה_לקוח'] && c['מזהה_לקוח'].toString() === clientId.toString());
  if (!clientData) return { success: false, error: "לקוח לא נמצא" };

  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות חומרי בנין");
  
  sheet.appendRow([
    new Date(),        // תאריך קליטה
    clientId,          // מספר לקוח
    clientData['שם_לקוח'], // שם לקוח
    "הזמנה מהצ'אט",    // שם פרויקט
    "",                // פרטי אספקה
    text,              // פריטים
    "",                // הערות
    "חדשה"             // סטטוס
  ]);
  
  const orderId = sheet.getLastRow();
  return { success: true, data: { orderId: `SBN-TXT-${orderId}` } };
}

function uploadFile(payload) { /* ... same working function ... */ }
function updateClientAddress(clientId, lat, lon) { /* ... same working function ... */ }

function createTestOrders() {
  const clientId = '60120';
  const clientName = 'בר אורניל';
  const projectName = 'אשר לוי';

  // --- FIX: Using correct headers for test data creation ---
  const containersSheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות מכולות");
  containersSheet.appendRow([
    `TEST-C-${Date.now()}`, // מספר_הזמנה
    clientId,               // מספר לקוח
    clientName,             // שם לקוח
    projectName,            // שם פרויקט
    '8 קוב',                // גודל
    new Date(),             // תאריך התחלה
    '',                     // תאריך סיום
    'פעיל'                  // סטטוס
  ]);
  Logger.log('Test container order created for Bar Ornil.');

  const materialsSheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות חומרי בנין");
  materialsSheet.appendRow([
    new Date(),             // תאריך קליטה
    clientId,               // מספר לקוח
    clientName,             // שם לקוח
    projectName,            // שם פרויקט
    'אספקה מיידית',         // פרטי אספקה
    '10 בלוקים, 5 שקי מלט', // פריטים
    'הזמנת בדיקה',          // הערות
    'חדשה'                  // סטטוס
  ]);
  Logger.log('Test materials order created for Bar Ornil.');
}

