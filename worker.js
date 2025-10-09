// 1. העתק את כל הקוד הזה.
// 2. הדבק אותו בעורך של Cloudflare Worker חדש.
// 3. החלף את הכתובת בשורה 8 בכתובת ה-API העדכנית שלך מ-Google Apps Script.

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // כתובת ה-API שלך בגוגל - החלף אותה בכתובת שלך!
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbwPAxCr_ZkpaCr3RfVH9Ih7Rw42f1YPCk3GqZjAZpEUnU2-yyE7aGu8rlcLdWYXoWrowA/exec';

  // 1. שכפול הבקשה המקורית כדי שנוכל לשנות אותה
  let modifiedRequest = new Request(googleScriptUrl, request);

  // 2. שליחת הבקשה המשוכפלת לשרת של גוגל
  const response = await fetch(modifiedRequest);

  // 3. שכפול התשובה מגוגל כדי שנוכל להוסיף לה Headers
  let modifiedResponse = new Response(response.body, response);

  // 4. הוספת הרשאות ה-CORS החסרות - זה כל הקסם
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  // אם הבקשה המקורית הייתה OPTIONS (preflight), החזר תשובה ריקה עם ההרשאות
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // 5. החזרת התשובה המתוקנת לאפליקציה שלך
  return modifiedResponse;
}
