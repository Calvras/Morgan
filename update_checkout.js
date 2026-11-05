const fs = require('fs');

let js = fs.readFileSync('public/assets/index-B7yQPykp.js', 'utf8');

// 1. Target the onSuccess handler
const oldOnSuccess = 'onSuccess:async ze=>{cx(e,ue),C(""),k(""),P(""),z(""),c(!0),b("");try{const et=await fetch(`/api/orders/${ze.id}/initialize-payment`,{method:"POST",credentials:"include"}),Vt=await et.json();if(!et.ok)throw new Error(Vt.error||"Payment initialization failed");if(a.invalidateQueries({queryKey:ns({sessionId:e})}),!Vt.checkoutUrl)throw new Error("Paystack checkout could not be prepared. Please try again.");window.location.assign(Vt.checkoutUrl)}catch(et){b(et.message||"Payment could not be started. Please try again."),c(!1)}}';

const newOnSuccess = 'onSuccess:async ze=>{cx(e,ue),C(""),k(""),P(""),z(""),c(!0),b("");a.invalidateQueries({queryKey:ns({sessionId:e})});try{const itemsText=(be?.items||[]).map(it=>{const n=it?.product?.name||it?.name||"Product";const c=it?.product?.code?` (${it.product.code})`:"";const q=it?.quantity||1;const pr=it?.product?.price?` - GH₵${(it.product.price*q).toFixed(2)}`:"";return`• ${q}x ${n}${c}${pr}`}).join("\\n");const cityText=(h?.city==="__other__"?h?.customCity:h?.city)||h?.customCity||"";const addr=[pe?.deliveryAddress,h?.street,cityText,h?.region].filter(Boolean).join(", ");const msg=["🛒 *NEW ORDER - MORGAN GOODS*",`Order #: ${ze?.orderNumber||ze?.id||"NEW"}`,"","👤 *CUSTOMER DETAILS:*",`• *Name:* ${pe?.customerName||"N/A"}`,`• *Phone:* ${pe?.customerPhone||"N/A"}`,`• *Address:* ${addr||"N/A"}`,pe?.nearestLandmark?`• *Landmark:* ${pe.nearestLandmark}`:null,"","📦 *ITEMS ORDERED:*",itemsText||"No items"," ",`💰 *TOTAL AMOUNT:* GH₵${Number(oe||be?.total||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,"","Please confirm my order and let me know when it will be delivered. Thank you!"].filter(Boolean).join("\\n");window.location.assign("https://wa.me/233592283011?text="+encodeURIComponent(msg))}catch(err){window.location.assign("https://wa.me/233592283011")}}';

if (!js.includes(oldOnSuccess)) {
  console.error('ERROR: oldOnSuccess not found in bundle!');
  process.exit(1);
}

js = js.replace(oldOnSuccess, newOnSuccess);

// 2. Target the Modal text: "Mobile Money payment" -> "Confirm Order"
const oldModal = 't.jsx(u3,{children:"Mobile Money payment"}),t.jsx(m3,{children:"Paystack will securely collect your card or Mobile Money details on its checkout page."})]}),t.jsx(d3,{children:t.jsx(f3,{onClick:Qe,children:"OK"})})';
const newModal = 't.jsx(u3,{children:"Confirm Order on WhatsApp"}),t.jsx(m3,{children:"Your order details and selected items will be sent directly to Morgan Goods via WhatsApp for confirmation and delivery."})]}),t.jsx(d3,{children:t.jsx(f3,{onClick:Qe,children:"Send to WhatsApp"})})';

if (js.includes(oldModal)) {
  js = js.replace(oldModal, newModal);
  console.log('Replaced modal text successfully!');
} else {
  console.warn('Warning: oldModal string not found, searching alternative...');
}

// 3. Target button text: `Pay ${vt(oe)}` -> `Confirm Order • ${vt(oe)}`
const oldBtn = 'children:Ae.isPending||o?"Processing…":`Pay ${vt(oe)}`}';
const newBtn = 'children:Ae.isPending||o?"Processing…":`Confirm Order • ${vt(oe)}`}';

if (js.includes(oldBtn)) {
  js = js.replace(oldBtn, newBtn);
  console.log('Replaced submit button text successfully!');
} else {
  console.warn('Warning: oldBtn string not found, searching alternative...');
}

// 4. Target Payment method header / box
const oldPayBox = 't.jsx("h4",{className:"font-bold text-blue-900",children:"Secure Payment"}),t.jsx("p",{className:"text-sm text-blue-800/80 mt-1",children:"Pay with Mobile Money (MTN MoMo, Telecel Cash/Vodafone, AirtelTigo Money)."})';
const newPayBox = 't.jsx("h4",{className:"font-bold text-green-900",children:"Order via WhatsApp"}),t.jsx("p",{className:"text-sm text-green-800/80 mt-1",children:"Confirm your order directly on WhatsApp. Pay on delivery or via Mobile Money with our sales rep."})';

if (js.includes(oldPayBox)) {
  js = js.replace(oldPayBox, newPayBox);
  console.log('Replaced payment banner text successfully!');
}

fs.writeFileSync('public/assets/index-B7yQPykp.js', js, 'utf8');
console.log('Successfully updated public/assets/index-B7yQPykp.js with WhatsApp checkout integration!');
