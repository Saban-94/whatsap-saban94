addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // כתובת ה-API שלך בגוגל - החלף אותה בכתובת שלך!
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbyWa5oVwe0foW8gN70CNCbadk5OlgdzfOx9aVf7gaKSEit1fJBB_AeW3EgYFrvXBfaAkA/exec';

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
