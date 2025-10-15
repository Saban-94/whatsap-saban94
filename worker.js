addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const action = body.action;
      
      // קריאה ל-Google Apps Script
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbyX2XqFeCQiiX1ehtPy-q-fZzGBDWZ9ZJvJ1FKe6C6PSKInAqVwlQRY6XABZtmqMbY8/exec';
      
      let payload = {
        ...body,
        source: 'web_app'
      };
      
      // הוספת טיפול בפעולות החדשות
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'שגיאה בשרת: ' + error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // טיפול ב-OPTIONS для CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
  
  return new Response('Not found', { status: 404 });
}
