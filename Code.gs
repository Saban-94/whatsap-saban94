const SS_ID = "146dXlaWJrYLcUiAhRCv3lCYrJuNDYGBOHkL86jgyvLI";
const DRIVE_FOLDER_ID = "1AWl10eAyTLOzNSp3LibtScDeH_SQKNZj";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let result;

    switch (body.action) {
      case 'getDashboardData': result = getDashboardData(body.clientId); break;
      case 'createOrderFromText': result = createOrderFromText(body.text, body.clientId, body.confirmed); break;
      case 'createFreeFormOrder': result = createFreeFormOrder(body.orderData, body.clientId); break;
      case 'uploadFile': result = uploadFile(body.payload); break;
      case 'updateClientAddress': result = updateClientAddress(body.clientId, body.lat, body.lon); break;
      case 'analyzeMessage': result = analyzeMessage(body.text, body.clientId); break;
      case 'diagnoseSystem': result = diagnoseSystem(body.clientId); break;
      case 'createMissingSheets': result = createMissingSheets(); break;
      case 'checkClientsSheet': result = checkClientsSheet(); break;
      case 'diagnoseClient': result = diagnoseClient(body.clientId); break;
      case 'generateOrderTemplate': result = generateOrderTemplate(body.orderData); break;
      default: throw new Error(`פעולה לא מוכרת: ${body.action}`);
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

function doGet(e) {
  return ContentService.createTextOutput("This script is running and responds to POST requests.");
}

// פונקציה ליצירת גיליונות חסרים
function createMissingSheets() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SS_ID);
    const results = [];
    
    // רשימת הגיליונות הנדרשים ומבניהם
    const requiredSheets = {
      "לקוחות": [
        "מזהה_לקוח", "שם_מלא", "כתובת", "טלפון", "תמונת_פרופיל", "אימייל", "תאריך הרשמה"
      ],
      "הזמנות מכולות": [
        "מספר_הזמנה", "מספר לקוח", "שם לקוח", "שם פרויקט", "גודל", 
        "תאריך התחלה", "תאריך סיום", "סטטוס", "כתובת", "lat", "lon"
      ],
      "הזמנות חומרי בנין": [
        "תאריך קליטה", "מספר לקוח", "שם לקוח", "שם פרויקט", "פרטי אספקה",
        "פריטים", "הערות", "סטטוס", "כתובת", "נתונים_מלאים", "קישור_הזמנה"
      ],
      "הזמנות מנופים": [
        "מספר_הזמנה", "מספר לקוח", "שם לקוח", "שם פרויקט", "סוג מנוף",
        "משך השכרה", "תאריך התחלה", "תאריך סיום", "סטטוס", "כתובת", "הערות"
      ],
      "פרויקטים": [
        "שם_פרויקט", "כתובת", "lat", "lon", "לקוח"
      ],
      "לוג הזמנות": [
        "תאריך", "מזהה הזמנה", "מזהה לקוח", "מוצר", "כמות", "סטטוס"
      ],
      "מוצרים": [
        "שם_מוצר", "קטגוריה", "כינויים", "מחיר", "יחידת_מידה", "זמינות", "תיאור"
      ]
    };
    
    for (const [sheetName, headers] of Object.entries(requiredSheets)) {
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
        sheet.appendRow(headers);
        results.push(`✅ נוצר גיליון: ${sheetName}`);
        Logger.log(`Created sheet: ${sheetName}`);
        
        // אם זה גיליון מוצרים, נוסיף נתונים
        if (sheetName === "מוצרים") {
          createProductsSheetIfMissing();
        }
      } else {
        results.push(`✅ גיליון קיים: ${sheetName}`);
      }
    }
    
    return {
      success: true,
      message: "בדיקת גיליונות הושלמה",
      results: results
    };
    
  } catch (error) {
    Logger.log(`Error creating sheets: ${error.toString()}`);
    return {
      success: false,
      error: `שגיאה ביצירת גיליונות: ${error.message}`
    };
  }
}

function getSheetDataAsObjects(sheetName) {
    try {
        const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(sheetName);
        if (!sheet) {
            Logger.log(`Sheet "${sheetName}" not found.`);
            return [];
        }
        const data = sheet.getDataRange().getValues();
        if (data.length === 0) {
            Logger.log(`Sheet "${sheetName}" is empty.`);
            return [];
        }
        const headers = data[0];
        if (!headers || headers.length === 0) {
            Logger.log(`Sheet "${sheetName}" has no headers.`);
            return [];
        }
        
        // ניקוי שמות העמודות - מסיר רווחים מיותרים
        const cleanHeaders = headers.map(header => header.toString().trim());
        
        // המרת השורות לאובייקטים (מדלג על שורת הכותרות)
        const result = [];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const obj = {};
            for (let j = 0; j < cleanHeaders.length; j++) {
                if (j < row.length) {
                    obj[cleanHeaders[j]] = row[j];
                } else {
                    obj[cleanHeaders[j]] = '';
                }
            }
            result.push(obj);
        }
        
        return result;
    } catch (error) {
        Logger.log(`Error in getSheetDataAsObjects for ${sheetName}: ${error}`);
        return [];
    }
}

function createProductsSheetIfMissing() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SS_ID);
    let sheet = spreadsheet.getSheetByName("מוצרים");
    
    if (sheet && sheet.getLastRow() <= 1) {
      // גיליון קיים אבל ריק - נוסיף נתונים
      const sampleProducts = [
        ["מלט אפור", "חומרי גלם", "מלט,צמנט,בטון,מלט אפור", 25, "שק", "כן", "מלט אפור 25 ק\"ג"],
        ["מלט לבן", "חומרי גלם", "מלט לבן,צמנט לבן", 35, "שק", "כן", "מלט לבן 25 ק\"ג"],
        ["חול", "חומרי גלם", "חול,חול לבניין,חול נהר", 15, "טון", "כן", "חול לבניין"],
        ["חצץ", "חומרי גלם", "חצץ,אבנים,אגרגט,חצץ לבניין", 20, "טון", "כן", "חצץ 0-4 מ\"מ"],
        ["בלוקים", "חומרי בניין", "בלוק,בלוקים,לבנים,לבנה,בלוק בטון", 8, "יחידה", "כן", "בלוק 20x20x40"],
        ["לבנים", "חומרי בניין", "לבנה,לבנים,אבן,לבני בניין", 12, "יחידה", "כן", "לבנים אדומות"],
        ["רעפים", "חומרי בניין", "רעף,רעפים,גג,רעפי גג", 15, "יחידה", "כן", "רעפים ספרדיים"],
        ["חול למילוי", "חומרי גלם", "חול מילוי,חול ליציקה,חול עפר", 12, "טון", "כן", "חול למילוי ויציקה"],
        ["חצץ לניקוז", "חומרי גלם", "חצץ ניקוז,אבני ניקוז,חצץ גס", 18, "טון", "כן", "חצץ 4-8 מ\"מ לניקוז"],
        ["רשת בנין", "חומרי בניין", "רשת,רשתות,רשת לבניין,רשת טיח", 45, "גליל", "כן", "רשת בניין 2x10 מטר"],
        ["טיח", "חומרי גמר", "טיח,טיח פנים,טיח חוץ,חומר טיח", 30, "שק", "כן", "טיח פנים-חוץ"],
        ["צבע", "חומרי גמר", "צבע,צבעי בניין,צבע קיר,צבע חוץ", 40, "ק\"ג", "כן", "צבע אקרילי לבן"],
        ["מכולה 6 מטר", "שכירות", "מכולה,קונטיינר,מיכל,מכולה קטנה", 500, "יחידה", "כן", "מכולה 6 מטר לשכירות"],
        ["מכולה 12 מטר", "שכירות", "מכולה גדולה,קונטיינר גדול,מכולה 12", 800, "יחידה", "כן", "מכולה 12 מטר לשכירות"],
        ["מנוף 25 טון", "שכירות", "מנוף,עגורן,מנוף בניין,מנוף 25", 1200, "יום", "כן", "מנוף 25 טון ליום עבודה"],
        ["מנוף 50 טון", "שכירות", "מנוף גדול,עגורן גדול,מנוף 50", 1800, "יום", "כן", "מנוף 50 טון ליום עבודה"]
      ];
      
      sampleProducts.forEach(product => sheet.appendRow(product));
      Logger.log('גיליון מוצרים אוּשר עם ' + sampleProducts.length + ' מוצרים');
    }
    
    return sheet;
  } catch (error) {
    Logger.log('שגיאה ביצירת גיליון מוצרים: ' + error);
    return null;
  }
}

function getDashboardData(clientId) {
    try {
        // יצירת גיליונות חסרים אם צריך
        createMissingSheets();
        
        const clients = getSheetDataAsObjects("לקוחות");
        Logger.log(`נמצאו ${clients.length} לקוחות במערכת`);
        
        // חיפוש גמיש יותר של הלקוח
        const clientData = clients.find(c => {
          const clientIdStr = clientId.toString().trim();
          const possibleIds = [
            c['מזהה_לקוח'] ? c['מזהה_לקוח'].toString().trim() : '',
            c['מספר לקוח'] ? c['מספר לקוח'].toString().trim() : '',
            c['מזהה לקוח'] ? c['מזהה לקוח'].toString().trim() : '',
            c['id'] ? c['id'].toString().trim() : '',
            c['clientId'] ? c['clientId'].toString().trim() : ''
          ];
          
          return possibleIds.some(id => id === clientIdStr);
        });
        
        if (!clientData) {
          const availableIds = clients.map(c => 
            c['מזהה_לקוח'] || c['מספר לקוח'] || c['מזהה לקוח'] || c['id'] || 'ללא מזהה'
          ).join(', ');
          
          Logger.log(`לקוח ${clientId} לא נמצא. מזההים זמינים: ${availableIds}`);
          return { 
            success: false, 
            error: "לקוח לא נמצא. אנא בדוק את מספר הלקוח." 
          };
        }

        Logger.log("לקוח נמצא: " + JSON.stringify(clientData));

        // מציאת שם הלקוח - מותאם למבנה הגיליון הספציפי
        const clientName = clientData['שם_מלא'] || clientData['שם_לקוח'] || clientData['שם לקוח'] || 
                          clientData['name'] || clientData['שם'] || 'לקוח';
        
        const clientAvatar = clientData['תמונת_פרופיל'] || clientData['תמונת פרופיל'] || 
                           clientData['avatar'] || 'https://i.postimg.cc/rsxW32Jj/logo.png';

        Logger.log(`📝 שם לקוח שנמצא עבור Dashboard: "${clientName}"`);

        const allProjects = getSheetDataAsObjects("פרויקטים");

        // חיפוש הזמנות מכולות
        const containersData = getSheetDataAsObjects("הזמנות מכולות");
        const containers = containersData
            .filter(o => {
              const orderClientId = o['מספר לקוח'] || o['מזהה_לקוח'] || o['מזהה לקוח'];
              return orderClientId && orderClientId.toString().trim() === clientId.toString().trim() && 
                     o.סטטוס !== 'סגור' && o.סטטוס !== 'הושלם';
            })
            .map(o => {
                const projectName = o['שם פרויקט'] || o['כתובת'] || 'פרויקט כללי';
                const project = allProjects.find(p => p['שם_פרויקט'] === projectName);
                return { 
                    type: 'container',
                    id: o['מספר_הזמנה'] || o['מספר הזמנה'] || `C${Date.now()}`,
                    project: projectName, 
                    status: o.סטטוס || 'פעיל', 
                    items: `מכולה ${o['גודל'] || o['סוג'] || ''}`.trim(),
                    startDate: o['תאריך התחלה'] || o['תאריך_התחלה'] || new Date(),
                    address: project ? project.כתובת : (o.כתובת || 'לא צוינה'),
                    lat: project ? project.lat : (o.lat || null),
                    lon: project ? project.lon : (o.lon || null)
                };
            });

        // חיפוש הזמנות חומרי בניין
        const materialsData = getSheetDataAsObjects("הזמנות חומרי בנין");
        const materials = materialsData
            .filter(o => {
              const orderClientId = o['מספר לקוח'] || o['מזהה_לקוח'] || o['מזהה לקוח'];
              return orderClientId && orderClientId.toString().trim() === clientId.toString().trim() && 
                     o.סטטוס !== 'סגור' && o.סטטוס !== 'הושלם';
            })
            .map(o => ({ 
                type: 'material',
                id: o['מספר_הזמנה'] || o['מספר הזמנה'] || `M${Date.now()}`,
                project: o['שם פרויקט'] || 'פרויקט כללי', 
                status: o.סטטוס || 'חדשה', 
                items: o['פריטים'] || o['מוצרים'] || 'לא צוין',
                address: o['כתובת'] || 'לא צוינה'
            }));

        // חיפוש הזמנות מנופים
        let cranes = [];
        try {
            const cranesData = getSheetDataAsObjects("הזמנות מנופים");
            cranes = cranesData
                .filter(o => {
                  const orderClientId = o['מספר לקוח'] || o['מזהה_לקוח'] || o['מזהה לקוח'];
                  return orderClientId && orderClientId.toString().trim() === clientId.toString().trim() && 
                         o.סטטוס !== 'סגור' && o.סטטוס !== 'הושלם';
                })
                .map(o => ({
                    type: 'crane',
                    id: o['מספר_הזמנה'] || o['מספר הזמנה'] || `CR${Date.now()}`,
                    project: o['שם פרויקט'] || 'פרויקט כללי',
                    status: o.סטטוס || 'חדשה',
                    items: `מנוף ${o['סוג מנוף'] || ''} - ${o['משך השכרה'] || ''}`.trim(),
                    address: o['כתובת'] || 'לא צוינה'
                }));
        } catch (e) {
            Logger.log('גיליון מנופים לא נמצא: ' + e.toString());
        }
        
        const allOrders = [...containers, ...materials, ...cranes];
        const stats = calculateOrderStats(allOrders);

        return { 
            success: true, 
            data: { 
                client: { 
                    id: clientData['מזהה_לקוח'] || clientData['מספר לקוח'] || 
                         clientData['מזהה לקוח'] || clientData['id'] || clientId,
                    name: clientName,
                    avatar: clientAvatar
                },
                dashboard: { 
                    orders: allOrders,
                    stats: stats,
                    lastUpdated: new Date().toISOString()
                }
            } 
        };
        
    } catch (error) {
        Logger.log('שגיאה ב-getDashboardData: ' + error.toString());
        return { 
            success: false, 
            error: 'שגיאה בטעינת נתונים: ' + error.message 
        };
    }
}

/**
 * מנתח הודעת טקסט ומזהה כוונות להזמנה
 */
function analyzeMessage(text, clientId) {
  try {
    var analysisResult = parseHebrewText(text);
    
    if (analysisResult.success) {
      return {
        success: true,
        data: {
          orderPreview: {
            product: analysisResult.product,
            quantity: analysisResult.quantity,
            unit: analysisResult.unit,
            estimatedPrice: analysisResult.estimatedPrice,
            confidence: analysisResult.confidence
          }
        }
      };
    } else {
      return {
        success: true,
        data: {
          message: getDefaultResponse(text)
        }
      };
    }
    
  } catch (error) {
    Logger.log('Error in analyzeMessage: ' + error.toString());
    return {
      success: false,
      error: 'שגיאה בניתוח ההודעה: ' + error.toString()
    };
  }
}

/**
 * מנתח טקסט בעברית כדי לחלץ פרטי הזמנה - גרסה משופרת עם גיליון מוצרים
 */
function parseHebrewText(text) {
  try {
    var lowerText = text.toLowerCase().trim();
    Logger.log(`🔍 מנתח טקסט: "${text}"`);
    
    // יצירת גיליון מוצרים אם חסר
    createProductsSheetIfMissing();
    
    // טעינת מוצרים מהגיליון
    const products = getSheetDataAsObjects("מוצרים");
    Logger.log(`📦 נמצאו ${products.length} מוצרים במערכת`);
    
    // חילוץ כמות
    var quantity = 1;
    var quantityMatch = lowerText.match(/(\d+)\s*(שק|ק"ג|קילו|טון|יחידה|יחידות|מטר|מ"ר|יום|ימים|גליל|קופסה|חבילה)/);
    if (quantityMatch) {
      quantity = parseInt(quantityMatch[1]);
      Logger.log(`🔢 נמצאה כמות: ${quantity} ${quantityMatch[2]}`);
    } else {
      // נסיון נוסף לחילוץ מספרים
      var simpleQuantityMatch = lowerText.match(/\d+/);
      if (simpleQuantityMatch) {
        quantity = parseInt(simpleQuantityMatch[0]);
        Logger.log(`🔢 נמצאה כמות מהטקסט: ${quantity}`);
      }
    }
    
    // חילוץ יחידה
    var unit = 'יחידה';
    var unitMatches = [
      { pattern: ['שק', 'שקים'], unit: 'שקים' },
      { pattern: ['ק"ג', 'קילו', 'קילוגרם'], unit: 'ק"ג' },
      { pattern: ['טון', 'טונות'], unit: 'טון' },
      { pattern: ['מטר', 'מ"ר', 'מטר רבוע'], unit: 'מ"ר' },
      { pattern: ['יום', 'ימים'], unit: 'ימים' },
      { pattern: ['גליל', 'גלילים'], unit: 'גליל' },
      { pattern: ['יחידה', 'יחידות'], unit: 'יחידה' }
    ];
    
    for (let match of unitMatches) {
      if (match.pattern.some(pattern => lowerText.includes(pattern))) {
        unit = match.unit;
        Logger.log(`📏 נמצאה יחידה: ${unit}`);
        break;
      }
    }
    
    // חיפוש מוצר בטקסט - באמצעות גיליון המוצרים
    var foundProduct = null;
    var confidence = 0;
    var matchedKeyword = '';
    
    for (var i = 0; i < products.length; i++) {
      var product = products[i];
      var productName = product['שם_מוצר'];
      var aliases = product['כינויים'] ? product['כינויים'].split(',') : [];
      
      // חיפוש לפי שם מוצר מלא
      if (productName && lowerText.includes(productName.toLowerCase())) {
        foundProduct = {
          name: productName,
          price: Number(product['מחיר']) || 0,
          unit: product['יחידת_מידה'] || unit,
          category: product['קטגוריה'] || ''
        };
        confidence = 0.9;
        matchedKeyword = productName;
        Logger.log(`✅ נמצא מוצר בשם מלא: ${productName}`);
        break;
      }
      
      // חיפוש לפי כינויים
      for (var j = 0; j < aliases.length; j++) {
        var alias = aliases[j].trim().toLowerCase();
        if (alias && lowerText.includes(alias)) {
          foundProduct = {
            name: productName,
            price: Number(product['מחיר']) || 0,
            unit: product['יחידת_מידה'] || unit,
            category: product['קטגוריה'] || ''
          };
          confidence = 0.8;
          matchedKeyword = alias;
          Logger.log(`✅ נמצא מוצר בכינוי: ${alias} -> ${productName}`);
          break;
        }
      }
      if (foundProduct) break;
    }
    
    // אם לא נמצא, ננסה חיפוש חלקי עם מילים בודדות
    if (!foundProduct) {
      var words = lowerText.split(/\s+/).filter(word => word.length > 2);
      Logger.log(`🔎 מחפש לפי מילים: ${words.join(', ')}`);
      
      for (var i = 0; i < words.length; i++) {
        var word = words[i];
        for (var j = 0; j < products.length; j++) {
          var product = products[j];
          var productName = product['שם_מוצר'];
          var aliases = product['כינויים'] ? product['כינויים'].split(',') : [];
          
          // חיפוש חלקי בשם המוצר
          if (productName && productName.toLowerCase().includes(word)) {
            foundProduct = {
              name: productName,
              price: Number(product['מחיר']) || 0,
              unit: product['יחידת_מידה'] || unit,
              category: product['קטגוריה'] || ''
            };
            confidence = 0.6;
            matchedKeyword = word;
            Logger.log(`✅ נמצא מוצר בחיפוש חלקי: ${word} -> ${productName}`);
            break;
          }
          
          // חיפוש חלקי בכינויים
          for (var k = 0; k < aliases.length; k++) {
            var alias = aliases[k].trim().toLowerCase();
            if (alias && alias.includes(word)) {
              foundProduct = {
                name: productName,
                price: Number(product['מחיר']) || 0,
                unit: product['יחידת_מידה'] || unit,
                category: product['קטגוריה'] || ''
              };
              confidence = 0.5;
              matchedKeyword = word;
              Logger.log(`✅ נמצא מוצר בכינוי חלקי: ${word} -> ${productName}`);
              break;
            }
          }
          if (foundProduct) break;
        }
        if (foundProduct) break;
      }
    }
    
    if (foundProduct) {
      var estimatedPrice = quantity * foundProduct.price;
      Logger.log(`💰 מחיר משוער: ${quantity} × ${foundProduct.price} = ${estimatedPrice} ש"ח`);
      
      return {
        success: true,
        product: foundProduct.name,
        quantity: quantity,
        unit: unit,
        estimatedPrice: estimatedPrice,
        confidence: confidence,
        category: foundProduct.category,
        matchedKeyword: matchedKeyword
      };
    }
    
    Logger.log('❌ לא נמצא מוצר מתאים בטקסט');
    return { 
      success: false,
      details: 'לא הצלחתי לזהות מוצר בהזמנה. נסה לפרט יותר כמו "מלט אפור 3 שקים" או "בלוקים 20 יחידות"'
    };
    
  } catch (error) {
    Logger.log('❌ שגיאה ב-parseHebrewText: ' + error.toString());
    return { 
      success: false,
      details: 'שגיאה בניתוח הטקסט: ' + error.message
    };
  }
}

/**
 * מחזיר תשובה מתאימה לפי הטקסט
 */
function getDefaultResponse(text) {
  var lowerText = text.toLowerCase();
  
  if (lowerText.includes('שלום') || lowerText.includes('היי') || lowerText.includes('בוקר') || lowerText.includes('ערב')) {
    return 'שלום! איך אוכל לעזור לך היום?';
  } else if (lowerText.includes('תודה') || lowerText.includes('תודהרבה')) {
    return 'בכיף! יש עוד משהו שאתה צריך?';
  } else if (lowerText.includes('מתי') || lowerText.includes('מתי תגיע')) {
    return 'אפשר לעקוב אחרי ההזמנה שלך בדשבורד. רוצה שאני אעביר אותך לשם?';
  } else if (lowerText.includes('מכולה') || lowerText.includes('קונטיינר')) {
    return 'אשמח לעזור עם הזמנת מכולה. תוכל לפרט את הגודל והמיקום?';
  } else if (lowerText.includes('מנוף') || lowerText.includes('עגורן')) {
    return 'אשמח לעזור עם הזמנת מנוף. תוכל לפרט את סוג המנוף ומשך ההשכרה?';
  } else {
    return 'אשמח לעזור! אתה יכול לבקש הזמנת חומרים (כמו "מלט אפור 3 שקים"), מכולה או מנוף.';
  }
}

/**
 * יוצר הזמנה חדשה מטקסט - עם תיקון שם לקוח
 */
function createOrderFromText(text, clientId, confirmed = false) {
  try {
    Logger.log(`🎯 מנסה ליצור הזמנה עבור לקוח: ${clientId}, טקסט: "${text}"`);
    
    // חיפוש לקוח עם לוגים מפורטים
    const clients = getSheetDataAsObjects("לקוחות");
    Logger.log(`נמצאו ${clients.length} לקוחות במערכת`);
    
    const clientData = clients.find(c => {
      const clientIdStr = clientId.toString().trim();
      const possibleIds = [
        c['מזהה_לקוח'] ? c['מזהה_לקוח'].toString().trim() : '',
        c['מספר לקוח'] ? c['מספר לקוח'].toString().trim() : '',
        c['מזהה לקוח'] ? c['מזהה לקוח'].toString().trim() : ''
      ];
      
      const found = possibleIds.some(id => id === clientIdStr);
      if (found) {
        Logger.log(`✅ נמצא לקוח: ${JSON.stringify(c)}`);
      }
      return found;
    });
    
    if (!clientData) {
      const availableIds = clients.map(c => 
        c['מזהה_לקוח'] || c['מספר לקוח'] || c['מזהה לקוח'] || 'ללא מזהה'
      ).join(', ');
      
      Logger.log(`❌ לקוח ${clientId} לא נמצא. מזההים זמינים: ${availableIds}`);
      return { 
        success: false, 
        error: "לקוח לא נמצא. אנא בדוק את מספר הלקוח." 
      };
    }

    // מציאת שם הלקוח - שימוש בשם_מלא כפי שמופיע בגיליון
    const clientName = clientData['שם_מלא'] || clientData['שם_לקוח'] || clientData['שם לקוח'] || 'לקוח';
    
    Logger.log(`📝 שם לקוח שנמצא: "${clientName}"`);

    // אם זו רק בקשה לניתוח (ללא אישור), נחזיר תצוגה מקדימה
    if (!confirmed) {
      var analysis = parseHebrewText(text);
      if (analysis.success) {
        Logger.log(`✅ ניתוח הצלחה: ${analysis.product} ${analysis.quantity} ${analysis.unit}`);
        return {
          success: true,
          data: {
            orderPreview: {
              product: analysis.product,
              quantity: analysis.quantity,
              unit: analysis.unit,
              estimatedPrice: analysis.estimatedPrice,
              category: analysis.category
            }
          }
        };
      } else {
        Logger.log(`❌ ניתוח נכשל: ${analysis.details}`);
        return {
          success: false,
          error: analysis.details || "לא הצלחתי לזהות הזמנה בטקסט ששלחת. נסה שוב עם פירוט מלא יותר."
        };
      }
    }

    // אם מאושר - ניצור את ההזמנה בפועל
    var analysis = parseHebrewText(text);
    if (!analysis.success) {
      return {
        success: false,
        error: analysis.details || "לא הצלחתי לעבד את ההזמנה. נסה שוב."
      };
    }

    // קביעת סוג הגיליון לפי קטגוריית המוצר
    var sheetName, orderData;
    var productCategory = analysis.category || '';
    
    if (productCategory.includes('שכירות') || analysis.product.includes('מכולה') || analysis.product.includes('מנוף')) {
      if (analysis.product.includes('מכולה')) {
        sheetName = "הזמנות מכולות";
        orderData = [
          `TXT-C-${Date.now()}`,
          clientId,
          clientName, // שימוש בשם הלקוח שנמצא
          'הזמנה מהצאט',
          `${analysis.quantity} ${analysis.unit}`,
          new Date(),
          '',
          'חדשה',
          clientData['כתובת'] || '',
          '',
          '',
          text
        ];
      } else if (analysis.product.includes('מנוף')) {
        sheetName = "הזמנות מנופים";
        orderData = [
          `TXT-CR-${Date.now()}`,
          clientId,
          clientName, // שימוש בשם הלקוח שנמצא
          'הזמנה מהצאט',
          analysis.product,
          `${analysis.quantity} ${analysis.unit}`,
          new Date(),
          '',
          'חדשה',
          clientData['כתובת'] || '',
          text
        ];
      }
    } else {
      // הזמנת חומרי בניין רגילה
      sheetName = "הזמנות חומרי בנין";
      orderData = [
        new Date(),
        clientId,
        clientName, // שימוש בשם הלקוח שנמצא
        'הזמנה מהצאט',
        'אספקה לפי הזמנה',
        `${analysis.quantity} ${analysis.unit} ${analysis.product}`,
        `מחיר משוער: ${analysis.estimatedPrice} ש"ח | קטגוריה: ${analysis.category}`,
        'חדשה',
        clientData['כתובת'] || '',
        text
      ];
    }

    // יצירת ההזמנה
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(sheetName);
    if (!sheet) {
      return {
        success: false,
        error: `גיליון ${sheetName} לא נמצא`
      };
    }
    
    sheet.appendRow(orderData);
    
    const orderId = sheet.getLastRow();
    const fullOrderId = `${sheetName === "הזמנות מכולות" ? "CONT" : sheetName === "הזמנות מנופים" ? "CRANE" : "MAT"}-${orderId}`;
    
    // רישום בלוג
    logOrderCreation(fullOrderId, clientId, analysis.product, analysis.quantity);
    
    Logger.log(`✅ הזמנה נוצרה בהצלחה: ${fullOrderId} - ${analysis.product} ${analysis.quantity} ${analysis.unit}`);
    
    return { 
      success: true, 
      data: { 
        orderId: fullOrderId,
        product: analysis.product,
        quantity: analysis.quantity,
        unit: analysis.unit,
        estimatedPrice: analysis.estimatedPrice,
        clientName: clientName,
        category: analysis.category
      } 
    };
    
  } catch (error) {
    Logger.log('❌ שגיאה ב-createOrderFromText: ' + error.toString());
    return {
      success: false,
      error: 'שגיאה ביצירת ההזמנה: ' + error.toString()
    };
  }
}

/**
 * יוצר הזמנה חופשית עם תבנית מעוצבת
 */
function createFreeFormOrder(orderData, clientId) {
  try {
    Logger.log(`🎯 יצירת הזמנה חופשית עבור לקוח: ${clientId}`);
    
    // שליפת נתוני הלקוח
    const clients = getSheetDataAsObjects("לקוחות");
    const clientData = clients.find(c => {
      const clientIdStr = clientId.toString().trim();
      const possibleIds = [
        c['מזהה_לקוח'] ? c['מזהה_לקוח'].toString().trim() : '',
        c['מספר לקוח'] ? c['מספר לקוח'].toString().trim() : '',
        c['מזהה לקוח'] ? c['מזהה לקוח'].toString().trim() : ''
      ];
      return possibleIds.some(id => id === clientIdStr);
    });
    
    if (!clientData) {
      return { success: false, error: "לקוח לא נמצא" };
    }

    // יצירת מזהה הזמנה
    const orderId = `FREE-${Date.now()}`;
    
    // שמירת ההזמנה בגיליון ההזמנות
    const ordersSheet = SpreadsheetApp.openById(SS_ID).getSheetByName("הזמנות חומרי בנין");
    const orderRow = [
      new Date(), // תאריך קליטה
      clientId, // מספר לקוח
      clientData['שם_מלא'] || clientData['שם_לקוח'] || 'לקוח', // שם לקוח
      orderData.projectName || 'הזמנה כללית', // שם פרויקט
      orderData.deliveryDetails || 'אספקה לפי הזמנה', // פרטי אספקה
      orderData.products, // פריטים
      orderData.notes || 'אין הערות', // הערות
      'מאושר', // סטטוס
      orderData.deliveryAddress || clientData['כתובת'] || '', // כתובת
      JSON.stringify(orderData), // נתונים מלאים
      '' // קישור_הזמנה (יימולא לאחר מכן)
    ];
    
    ordersSheet.appendRow(orderRow);
    
    // יצירת תבנית מעוצבת
    const orderTemplate = generateOrderTemplate({
      ...orderData,
      orderId: orderId,
      clientName: clientData['שם_מלא'] || clientData['שם_לקוח'] || 'לקוח',
      clientPhone: clientData['טלפון'] || '',
      clientEmail: clientData['אימייל'] || '',
      projectAddress: orderData.projectAddress || orderData.deliveryAddress || ''
    });
    
    // שמירת התבנית ב-Google Drive
    const htmlBlob = Utilities.newBlob(orderTemplate, 'text/html', `הזמנה_${orderId}.html`);
    const driveFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const htmlFile = driveFolder.createFile(htmlBlob);
    htmlFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // יצירת קובץ PDF (אופציונלי)
    const pdfBlob = htmlFile.getAs('application/pdf');
    const pdfFile = driveFolder.createFile(pdfBlob).setName(`הזמנה_${orderId}.pdf`);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // עדכון השורה עם קישור ההזמנה
    const lastRow = ordersSheet.getLastRow();
    ordersSheet.getRange(lastRow, 11).setValue(htmlFile.getUrl());
    
    // רישום בלוג
    logOrderCreation(orderId, clientId, 'הזמנה חופשית', 1);
    
    Logger.log(`✅ הזמנה חופשית נוצרה: ${orderId}`);
    
    return {
      success: true,
      data: {
        orderId: orderId,
        htmlUrl: htmlFile.getUrl(),
        pdfUrl: pdfFile.getUrl(),
        viewUrl: htmlFile.getUrl(),
        message: "ההזמנה נוצרה בהצלחה והועמדה לשיתוף!"
      }
    };
    
  } catch (error) {
    Logger.log(`❌ שגיאה ב-createFreeFormOrder: ${error}`);
    return {
      success: false,
      error: 'שגיאה ביצירת ההזמנה: ' + error.message
    };
  }
}

/**
 * מייצר תבנית HTML מעוצבת להזמנה - גרסה משודרגת להדפסה
 */
/**
 * מייצר תבנית HTML מעוצבת להזמנה - גרסה קומפקטית להדפסה
 */
/**
 * מייצר תבנית HTML קומפקטית להדפסה - גרסה אולטרה-קומפקטית
 */
/**
 * מייצר תבנית HTML קומפקטית להדפסה - גרסה אולטרה-קומפקטית
 */
function generateOrderTemplate(orderData) {
  // פונקציית עזר לקצר טקסט אם ארוך מדי
  const shortenText = (text, maxLength = 30) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const template = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>הזמנה - ${orderData.projectName || 'פרויקט'}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Assistant', sans-serif;
            line-height: 1.2;
            color: #000;
            background: white;
            padding: 0;
            margin: 0;
            font-size: 10px;
        }
        
        /* הגדרות הדפסה - קריטיות! */
        @media print {
            @page {
                size: A4;
                margin: 5mm;
            }
            
            body {
                font-size: 9px !important;
                line-height: 1.1 !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            
            .no-print {
                display: none !important;
            }
            
            .order-container {
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
            }
        }
        
        .order-container {
            width: 100%;
            max-width: 200mm;
            margin: 0 auto;
            background: white;
            padding: 3mm;
        }
        
        /* כותרת קומפקטית */
        .header {
            text-align: center;
            padding: 2mm 0;
            margin-bottom: 2mm;
            border-bottom: 1px solid #333;
        }
        
        .header h1 {
            font-size: 1.8em;
            margin: 0;
            font-weight: 700;
            color: #000;
        }
        
        .order-id {
            font-size: 1em;
            font-weight: 600;
            margin-top: 1mm;
        }
        
        .order-meta {
            font-size: 0.9em;
            color: #666;
            margin-top: 1mm;
        }
        
        /* פריסה קומפקטית - טבלאות במקום sections */
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2mm;
            font-size: 0.9em;
        }
        
        .info-table td {
            padding: 1mm 2mm;
            vertical-align: top;
            border: 0.5px solid #ddd;
        }
        
        .info-label {
            font-weight: 600;
            background: #f5f5f5;
            width: 25%;
            text-align: left;
        }
        
        .info-value {
            width: 75%;
        }
        
        /* טבלת מוצרים קומפקטית */
        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 2mm 0;
            font-size: 0.9em;
        }
        
        .products-table th {
            background: #333;
            color: white;
            padding: 1.5mm 2mm;
            text-align: right;
            font-weight: 600;
            border: 0.5px solid #333;
        }
        
        .products-table td {
            padding: 1mm 2mm;
            border: 0.5px solid #ddd;
            text-align: right;
        }
        
        .products-table tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        /* הערות קומפקטיות */
        .notes-section {
            margin: 2mm 0;
            padding: 2mm;
            background: #fffaf0;
            border: 0.5px solid #fed7aa;
            border-radius: 2px;
            font-size: 0.9em;
        }
        
        .notes-title {
            font-weight: 600;
            margin-bottom: 1mm;
            color: #333;
        }
        
        /* פוטר קומפקטי */
        .footer {
            text-align: center;
            padding: 2mm 0;
            margin-top: 2mm;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.8em;
        }
        
        /* כפתורים - רק להצגה על המסך */
        .action-buttons {
            display: flex;
            justify-content: center;
            gap: 2mm;
            margin: 3mm 0;
        }
        
        .action-btn {
            padding: 1mm 3mm;
            background: #333;
            color: white;
            text-decoration: none;
            border-radius: 2px;
            font-size: 0.9em;
            border: none;
            cursor: pointer;
        }
        
        /* מחלקות עזר */
        .compact-text {
            font-size: 0.9em;
            line-height: 1.1;
        }
        
        .no-border {
            border: none !important;
        }
        
        .text-center {
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="order-container">
        <!-- כותרת -->
        <div class="header">
            <h1>הזמנת חומרי בניין</h1>
            <div class="order-id">מספר הזמנה: ${orderData.orderId || 'לא צוין'}</div>
            <div class="order-meta">
                תאריך יצירה: ${new Date().toLocaleDateString('he-IL')} | מערכת ח.סבן
            </div>
        </div>
        
        <!-- פרטי לקוח ופרויקט בטבלה אחת -->
        <table class="info-table">
            <tr>
                <td class="info-label">👤 שם לקוח:</td>
                <td class="info-value">${shortenText(orderData.clientName) || 'לא צוין'}</td>
                <td class="info-label">📞 טלפון:</td>
                <td class="info-value">${orderData.clientPhone || 'לא צוין'}</td>
            </tr>
            <tr>
                <td class="info-label">🏗️ שם פרויקט:</td>
                <td class="info-value">${shortenText(orderData.projectName, 25) || 'לא צוין'}</td>
                <td class="info-label">👨‍💼 מנהל פרויקט:</td>
                <td class="info-value">${shortenText(orderData.projectManager) || 'לא צוין'}</td>
            </tr>
            <tr>
                <td class="info-label">📍 כתובת פרויקט:</td>
                <td class="info-value" colspan="3">${shortenText(orderData.projectAddress, 50) || 'לא צוין'}</td>
            </tr>
        </table>
        
        <!-- פרטי אספקה -->
        <table class="info-table">
            <tr>
                <td class="info-label">🚚 כתובת אספקה:</td>
                <td class="info-value" colspan="3">${shortenText(orderData.deliveryAddress, 50) || 'לא צוין'}</td>
            </tr>
            <tr>
                <td class="info-label">📅 תאריך אספקה:</td>
                <td class="info-value">${orderData.deliveryDate || 'לפי תיאום'}</td>
                <td class="info-label">⏰ שעה:</td>
                <td class="info-value">${orderData.deliveryTime || '08:00-17:00'}</td>
            </tr>
            ${orderData.deliveryNotes ? `
            <tr>
                <td class="info-label">📝 הערות אספקה:</td>
                <td class="info-value" colspan="3">${shortenText(orderData.deliveryNotes, 40)}</td>
            </tr>
            ` : ''}
        </table>
        
        <!-- מוצרים -->
        <table class="products-table">
            <thead>
                <tr>
                    <th width="50%">מוצר</th>
                    <th width="20%">כמות</th>
                    <th width="30%">הערות</th>
                </tr>
            </thead>
            <tbody>
                ${orderData.products ? orderData.products.split('\n')
                    .filter(product => product.trim())
                    .slice(0, 10) // עד 10 שורות מקסימום
                    .map((product, index) => {
                        const parts = product.split('-').map(p => p.trim());
                        return `<tr>
                            <td>${shortenText(parts[0] || product, 35)}</td>
                            <td>${parts[1] || '-'}</td>
                            <td>${shortenText(parts[2] || '-', 20)}</td>
                        </tr>`;
                    }).join('') 
                : '<tr><td colspan="3" class="text-center">לא צוינו מוצרים</td></tr>'}
                ${orderData.products && orderData.products.split('\n').filter(product => product.trim()).length > 10 ? 
                `<tr>
                    <td colspan="3" class="text-center" style="font-style: italic; color: #666; background: #f0f0f0;">
                        + ${orderData.products.split('\n').filter(product => product.trim()).length - 10} מוצרים נוספים
                    </td>
                </tr>` 
                : ''}
            </tbody>
        </table>
        
        <!-- הערות נוספות -->
        ${orderData.notes ? `
        <div class="notes-section">
            <div class="notes-title">📝 הערות נוספות:</div>
            <div class="compact-text">${shortenText(orderData.notes, 100)}</div>
        </div>
        ` : ''}
        
        <!-- כפתורי פעולה - מוסתרים בהדפסה -->
        <div class="action-buttons no-print">
            <a href="https://wa.me/?text=שלום, ברצוני לתאם אספקה להזמנה ${orderData.orderId}" 
               class="action-btn" target="_blank" style="background: #25D366;">
               📞 שלח לווצאפ
            </a>
            ${orderData.clientPhone ? `
            <a href="tel:${orderData.clientPhone}" class="action-btn" style="background: #008069;">
               📞 התקשר
            </a>
            ` : ''}
            <button onclick="window.print()" class="action-btn" style="background: #4a5568;">
               🖨️ הדפס
            </button>
        </div>
        
        <!-- פוטר -->
        <div class="footer">
            <div>הזמנה זו נוצרה באופן אוטומטי באמצעות מערכת ח.סבן</div>
            <div>לפרטים נוספים: 03-1234567 | דוא"ל: info@saban.co.il</div>
        </div>
    </div>
</body>
</html>`;
  
  return template;
}
