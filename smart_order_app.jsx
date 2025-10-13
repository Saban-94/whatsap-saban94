import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// --- Firebase Configuration (Provided by the environment) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Mock Data (for login demonstration) ---
const MOCK_CUSTOMERS = [
  { id: 'cust_1', name: 'ח.ענבר אחזקות', projects: ['תל אביב (1)', 'פרויקט גבעתיים'], phone: '052-5777307' },
  { id: 'cust_2', name: 'תחסין אורניל ניהול', projects: ['בית אילן מהלה'], phone: '052-5354552' },
  { id: 'cust_3', name: 'רותם כחילה', projects: ['כפר סבא אבא קובנר 6'], phone: '052-4811575' },
  { id: 'cust_4', name: 'לקוח חדש', projects: [], phone: '' }
];

// --- Main App Component ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [showNotification, setShowNotification] = useState(null);

  // Handle Firebase authentication
  useEffect(() => {
    const handleAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    handleAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);
  
  // Listen for new orders from Firestore in real-time
  useEffect(() => {
    if (!firebaseUser) return; // Don't fetch data until authenticated

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = [];
      const isInitialLoad = orders.length === 0;
      querySnapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() });
      });
      
      if (!isInitialLoad && ordersData.length > orders.length) {
          const newOrder = ordersData[0];
          setShowNotification(`הזמנה חדשה התקבלה מלקוח: ${newOrder.customerName}`);
          setTimeout(() => setShowNotification(null), 5000);
      }
      setOrders(ordersData);
    }, (error) => {
        console.error("Firestore Snapshot Error:", error);
    });

    return () => unsubscribe();
  }, [firebaseUser, orders.length]);

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans" dir="rtl">
        {showNotification && (
            <div className="fixed top-5 right-5 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 animate-fade-in-down">
                {showNotification}
            </div>
        )}
      <OrderWorkspace currentUser={currentUser} onLogout={() => setCurrentUser(null)} initialOrders={orders} />
    </div>
  );
}

// --- Login Screen Component ---
function LoginScreen({ onLogin }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200">
      <div className="bg-white p-8 rounded-xl shadow-2xl text-center w-full max-w-md">
        <h1 className="text-3xl font-bold text-indigo-700 mb-2">מערכת ניהול הזמנות</h1>
        <p className="text-gray-600 mb-8">נא לבחור פרופיל לקוח לכניסה</p>
        <div className="space-y-3">
          {MOCK_CUSTOMERS.map(customer => (
            <button
              key={customer.id}
              onClick={() => onLogin(customer)}
              className="w-full text-right p-4 bg-gray-100 hover:bg-indigo-100 rounded-lg transition-all duration-200 text-lg"
            >
              {customer.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Workspace Component ---
function OrderWorkspace({ currentUser, onLogout, initialOrders }) {
  const [view, setView] = useState('list'); // 'list' or 'new'
  const [selectedOrder, setSelectedOrder] = useState(null);

  const customerOrders = useMemo(() => 
    initialOrders.filter(o => o.customerId === currentUser.id)
  , [initialOrders, currentUser.id]);

  const handleNewOrder = () => {
    setSelectedOrder(null);
    setView('new');
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setView('view');
  };
  
  const handleOrderSubmitted = (order) => {
      setView('view');
      setSelectedOrder(order);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">שלום, {currentUser.name}</h1>
            <p className="text-gray-500">ברוך הבא לאזור האישי שלך</p>
        </div>
        <button onClick={onLogout} className="text-gray-600 hover:text-indigo-600">התנתקות</button>
      </header>

      {view === 'list' && (
        <>
          <button onClick={handleNewOrder} className="mb-6 w-full sm:w-auto bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-all">
            + יצירת הזמנה חדשה
          </button>
          <OrdersList orders={customerOrders} onViewOrder={handleViewOrder} />
        </>
      )}
      
      {view === 'new' && <NewOrderForm customer={currentUser} onBack={() => setView('list')} onOrderSubmitted={handleOrderSubmitted} />}

      {view === 'view' && selectedOrder && <OrderTicket order={selectedOrder} onBack={() => setView('list')} />}
    </div>
  );
}

// --- Orders List Component ---
function OrdersList({ orders, onViewOrder }) {
    if (orders.length === 0) {
        return <div className="text-center p-10 bg-white rounded-lg shadow-md"><p className="text-gray-500">עדיין לא ביצעת הזמנות.</p></div>
    }
    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <ul className="divide-y divide-gray-200">
                {orders.map(order => (
                    <li key={order.id} onClick={() => onViewOrder(order)} className="p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-indigo-700">הזמנה #{order.id.slice(-4)}</p>
                            <p className="text-sm text-gray-600">פרויקט: {order.projectName}</p>
                            <p className="text-xs text-gray-400">בתאריך: {order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('he-IL') : 'Unknown Date'}</p>
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-gray-800">{order.totalAmount?.toLocaleString('he-IL', {style: 'currency', currency: 'ILS'})}</p>
                             <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.status === 'חדשה' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                {order.status || 'חדשה'}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// --- New Order Form Component ---
const NewOrderForm = ({ customer, onBack, onOrderSubmitted }) => {
    const [orderType, setOrderType] = useState('materials');
    const [projectName, setProjectName] = useState(customer.projects[0] || '');
    const [pastedText, setPastedText] = useState('');
    const [items, setItems] = useState([]);
    const [deliveryAddress, setDeliveryAddress] = useState({ text: '', coords: null });
    const [attachments, setAttachments] = useState([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePaste = (e) => {
        const text = e.target.value;
        setPastedText(text);
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const parsedItems = lines.map((line, index) => {
            const match = line.match(/(\d+)/);
            const quantity = match ? parseInt(match[1], 10) : 1;
            const name = line.replace(/(\d+)/, '').trim();
            return { id: Date.now() + index, name: name || 'פריט לא מזוהה', quantity };
        });
        setItems(parsedItems);
    };
    
    const handleFileChange = (e) => {
        setAttachments(Array.from(e.target.files));
    };

    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0), [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const orderData = {
            customerId: customer.id,
            customerName: customer.name,
            orderType,
            projectName,
            items,
            deliveryAddress,
            attachments: attachments.map(f => f.name), // In real app, upload files and store URLs
            notes,
            totalAmount,
            status: 'חדשה',
            createdAt: new Date(),
        };

        try {
            const docRef = await addDoc(collection(db, "orders"), orderData);
            console.log("Order submitted to Firestore with ID: ", docRef.id);

            // SIMULATION: Saving to Google Drive & WhatsApp
            console.log(`// SIMULATING: Creating Google Drive folder 'Order-${docRef.id}' and uploading files.`);
            const whatsAppMessage = `הזמנה חדשה התקבלה!\n*לקוח:* ${customer.name}\n*פרויקט:* ${projectName}\n*סוג:* ${orderType === 'materials' ? 'חומרי בניין' : 'מכולה'}\n*קישור:* https://my-app.com/order/${docRef.id}`;
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppMessage)}`;
            console.log("WhatsApp share URL:", whatsappUrl);
            window.open(whatsappUrl, '_blank');
            
            onOrderSubmitted({id: docRef.id, ...orderData, createdAt: { toDate: () => new Date() } }); // Simulate Firestore timestamp object

        } catch (error) {
            console.error("Error adding document: ", error);
            alert("שגיאה בשליחת ההזמנה. נסה שוב.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">הזמנה חדשה</h2>
                <button type="button" onClick={onBack} className="text-gray-500 hover:text-gray-800">&times; סגור</button>
            </div>

            {/* Step 1: Order Details */}
            <fieldset className="border p-4 rounded-md">
                <legend className="px-2 font-semibold">פרטי הזמנה</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">שם פרויקט</label>
                        <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full p-2 border rounded-md mt-1" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">סוג הזמנה</label>
                        <select value={orderType} onChange={e => setOrderType(e.target.value)} className="w-full p-2 border rounded-md mt-1 bg-white">
                            <option value="materials">חומרי בניין</option>
                            <option value="container">מכולה לפינוי פסולת (8 קוב)</option>
                        </select>
                    </div>
                </div>
            </fieldset>

            {/* Step 2: Items */}
            {orderType === 'materials' && (
                 <fieldset className="border p-4 rounded-md">
                    <legend className="px-2 font-semibold">פירוט חומרים</legend>
                    <p className="text-sm text-gray-500 mb-2">הדבק כאן רשימת חומרים. המערכת תנסה לסדר אותה אוטומטית.</p>
                    <textarea 
                        value={pastedText}
                        onChange={handlePaste}
                        rows="5"
                        placeholder="דוגמה:&#10;20 שקי מלט&#10;בלוק בטון 4 95 יח'&#10;1 שק גדול חול"
                        className="w-full p-2 border rounded-md"
                    />
                    <h3 className="mt-4 font-semibold">רשימת פריטים להזמנה:</h3>
                    <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                        {items.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input type="number" value={item.quantity} onChange={e => {
                                    const newItems = [...items];
                                    newItems[index].quantity = parseInt(e.target.value, 10) || 0;
                                    setItems(newItems);
                                }} className="p-2 border rounded-md w-20" />
                                <input type="text" value={item.name} onChange={e => {
                                    const newItems = [...items];
                                    newItems[index].name = e.target.value;
                                    setItems(newItems);
                                }} className="p-2 border rounded-md flex-1" />
                            </div>
                        ))}
                    </div>
                 </fieldset>
            )}

            {/* Step 3: Delivery and Attachments */}
            <fieldset className="border p-4 rounded-md">
                <legend className="px-2 font-semibold">אספקה וקבצים</legend>
                <label className="block text-sm font-medium">כתובת למשלוח</label>
                <MapInput onAddressChange={setDeliveryAddress} />
                <div className="mt-4">
                    <label className="block text-sm font-medium">הערות</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-md mt-1" rows="3"></textarea>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium">צרף תמונות או מסמכים</label>
                    <input type="file" multiple onChange={handleFileChange} className="mt-1" />
                    <div className="text-sm text-gray-500 mt-1">
                        {attachments.map(f => <span key={f.name} className="block">{f.name}</span>)}
                    </div>
                </div>
            </fieldset>

            {/* Submission */}
            <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-all disabled:bg-gray-400 w-full sm:w-auto">
                    {isSubmitting ? 'שולח...' : 'שלח הזמנה'}
                </button>
            </div>
        </form>
    );
};


// --- Map Input Component ---
function MapInput({ onAddressChange }) {
    const mapRef = useRef(null);
    const [addressText, setAddressText] = useState('');

    useEffect(() => {
        // Placeholder for Google Map initialization
        if (mapRef.current) {
           console.log("Map would be initialized here.");
        }
    }, [mapRef]);
    
    const handleAddressChange = (e) => {
        const text = e.target.value;
        setAddressText(text);
        onAddressChange({ text, coords: { lat: 32.0853, lng: 34.7818 } }); // Mock coords
    }

    return (
        <div className="mt-1">
            <input 
                type="text" 
                value={addressText}
                onChange={handleAddressChange}
                placeholder="הקלד כתובת או בחר על המפה"
                className="w-full p-2 border rounded-md mt-1 mb-2"
            />
            <div ref={mapRef} className="w-full h-48 bg-gray-200 rounded-md flex items-center justify-center">
                <p className="text-gray-500">מפה דינאמית תוצג כאן</p>
            </div>
        </div>
    );
}

// --- Order Ticket Display ---
function OrderTicket({ order, onBack }) {
    const createdAtDate = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date();
    
    return (
         <div className="bg-white p-6 rounded-lg shadow-lg relative">
            <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
            
            <div className="flex justify-between items-start mb-6 pb-4 border-b">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">הזמנה #{order.id.slice(-4)}</h1>
                    <p className="text-gray-500">בתאריך: {createdAtDate.toLocaleDateString('he-IL')}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-semibold text-indigo-700">{order.customerName}</h2>
                    <p>פרויקט: {order.projectName}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="font-bold mb-2">פרטי הזמנה</h3>
                    <p><strong>סוג:</strong> {order.orderType === 'materials' ? 'חומרי בניין' : 'מכולה'}</p>
                    {order.orderType === 'materials' && order.items && (
                        <table className="w-full text-right mt-4 text-sm">
                            <thead className="bg-gray-100"><tr><th className="p-2">כמות</th><th className="p-2">פריט</th></tr></thead>
                            <tbody>
                                {order.items.map((item, i) => <tr key={i} className="border-b"><td className="p-2">{item.quantity}</td><td className="p-2">{item.name}</td></tr>)}
                            </tbody>
                        </table>
                    )}
                </div>
                 <div>
                    <h3 className="font-bold mb-2">פרטי אספקה</h3>
                    <p><strong>כתובת:</strong> {order.deliveryAddress.text}</p>
                    <div className="w-full h-40 bg-gray-200 rounded-md mt-2 flex items-center justify-center">
                       <p className="text-gray-500">מפת מיקום</p>
                    </div>
                    {order.notes && <p className="mt-4"><strong>הערות:</strong> {order.notes}</p>}
                    {order.attachments?.length > 0 && <div className="mt-4">
                        <p><strong>קבצים מצורפים:</strong></p>
                        <ul className="list-disc pr-5 text-sm">
                            {order.attachments.map(file => <li key={file}>{file}</li>)}
                        </ul>
                    </div>}
                </div>
            </div>
        </div>
    )
}

