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
  // Simple check to confirm the script is deployed and running.
  return ContentService.createTextOutput("The script is running and responds to GET requests.");
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
        .filter(o => o['מזהה_לקוח'] && o['מזהה_לקוח'].toString() === clientId.toString() && o.סטטוס !== 'סגור')
        .map(o => {
            const project = allProjects.find(p => p['שם_פרויקט'] === o['שם_פרויקט']);
            return { 
                type: 'container',
                id: o['מספר_הזמנה'] || `C${Math.random()}`,
                project: o['שם_פרויקט'], 
                status: o.סטטוס, 
                items: `מכולה ${o['גודל'] || ''}`.trim(),
                startDate: o['תאריך_פתיחה'],
                address: project ? project.כתובת : '',
                lat: project ? project.lat : null,
                lon: project ? project.lon : null
            };
        });

    const materials = getSheetDataAsObjects("הזמנות חומרי בנין")
        .filter(o => o['מזהה_לקוח'] && o['מזהה_לקוח'].toString() === clientId.toString() && o.סטטוס !== 'סגור')
        .map(o => ({ 
            type: 'material',
            id: o['מספר_הזמנה'] || `M${Math.random()}`,
            project: o['שם_פרויקט'], 
            status: o.סטטוס, 
            items: o['פירוט_הזמנה'] 
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
    text,              // פירוט_הזמנה
    "",                // הערות
    "חדשה"             // סטטוס
  ]);
  
  const orderId = sheet.getLastRow(); // A simple way to get a unique ID for the new order.
  return { success: true, data: { orderId: `SBN-TXT-${orderId}` } };
}

function uploadFile(payload) { /* ... same working function ... */ }
function updateClientAddress(clientId, lat, lon) { /* ... same working function ... */ }


// --- פונקציית בדיקה חדשה ---
/**
 * To run this function:
 * 1. Open the Apps Script editor.
 * 2. In the toolbar at the top, select "createTestOrders" from the function dropdown.
 * 3. Click the "Run" button.
 * This will add two new test orders for client 60120 to your Google Sheets.
 */
function createTestOrders() {
  const clientId = '60120';
  const clientName = 'בר אורניל';
  const projectName = 'אשר לוי';

  // 1. Create a container order
  const containersSheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות מכולות");
  containersSheet.appendRow([
    `TEST-C-${Date.now()}`, // מספר_הזמנה
    clientId,               // מזהה_לקוח
    clientName,             // שם_לקוח
    projectName,            // שם_פרויקט
    '8 קוב',                // גודל
    new Date(),             // תאריך_פתיחה
    '',                     // תאריך_סיום
    'פעיל'                  // סטטוס
  ]);
  Logger.log('Test container order created for Bar Ornil.');

  // 2. Create a building materials order
  const materialsSheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות חומרי בנין");
  materialsSheet.appendRow([
    new Date(),             // תאריך קליטה
    clientId,               // מספר לקוח
    clientName,             // שם לקוח
    projectName,            // שם פרויקט
    'אספקה מיידית',         // פרטי אספקה
    '10 בלוקים, 5 שקי מלט', // פירוט_הזמנה
    'הזמנת בדיקה',          // הערות
    'חדשה'                  // סטטוס
  ]);
  Logger.log('Test materials order created for Bar Ornil.');
}

