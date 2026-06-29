const SUPABASE_URL = 'https://rdfxkunntwffxibaoqnk.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_lYXIa2nPYnpn6CGpPHNVEw_yDOp0P13';

const HST_RATE = 0.13;
const STAFF_MEMBERS = ['Anna', 'Kim', 'Rose', 'Maira', 'Yuzu', 'Komal', 'Ruby', 'Linda'];

// CENTRALIZED PRICING DICTIONARY
const SALON_MENU = {
    products: {
        "Full Set (No Colour)": 35.00,
        "Refill (No Colour)": 30.00,
        "Full Set (With Colour)": 45.00,
        "Refill (With Colour)": 40.00,
        "Overlay (Real Nails - No Colour)": 30.00,
        "Overlay (Real Nails - With Colour)": 40.00,
        "Manicure (No Colour)": 15.00,
        "Manicure (With Colour)": 25.00,
        "Spa Pedicure (No Colour)": 35.00,
        "Spa Pedicure (With Colour)": 45.00,
        "Spa Pedicure & Manicure (No Colour)": 50.00,
        "Spa Pedicure & Manicure (Colour)": 70.00,
        "Colour Change (Fingers)": 20.00,
        "Colour Change (Toes)": 20.00,
        "Shellac Removal": 7.00,
        "Artificial Nail Removal": 17.00,
        "Finger Nails Trim": 10.00,
        "Toe Nails Trim": 10.00,
        "Facial Treatment": 45.00
    },
    services: {
        "None / No Add-on": 0.00,
        "French Finish": 10.00,
        "Nail Design": 5.00,
        "Chrome Finish": 10.00,
        "Ombre Look": 15.00,
        "Extra Length Extension": 5.00,
        "Take Off Shellac Add-on": 5.00,
        "Waxing: Eyebrows": 8.00,
        "Waxing: Upper Lips": 5.00,
        "Waxing: Chin": 6.00,
        "Waxing: Full Face": 25.00,
        "Waxing: Full Body": 130.00,
        "Threading: Eyebrows": 8.00,
        "Threading: Upper Lips": 5.00,
        "Threading: Chin": 6.00,
        "Eyelash: Single (One by One)": 75.00,
        "Eyelash: Refill Single Lashes": 50.00,
        "Eyelash: Strip Lashes": 15.00,
        "Eyelash: Individual Lashes": 40.00,
        "Lash Lift": 25.00,
        "Eyebrow/Eyelash Tinting": 10.00
    }
};

let supabaseClient = null;

// Form DOM selectors
const receiptForm = document.getElementById('receiptForm');
const servicedBySelect = document.getElementById('servicedBy');
const productSelect = document.getElementById('productSelect');
const productQtyInput = document.getElementById('productQty');
const serviceSelect = document.getElementById('serviceSelect');
const serviceQtyInput = document.getElementById('serviceQty');
const miscInput = document.getElementById('miscInput');
const submitBtn = document.getElementById('submitBtn');
const receiptBox = document.getElementById('receiptBox');
const placeholderText = document.getElementById('placeholderText');

// Auth DOM selectors
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginOverlay = document.getElementById('loginOverlay');
const appWorkspace = document.getElementById('appWorkspace');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

function initFormElements() {
    servicedBySelect.innerHTML = '';
    productSelect.innerHTML = '';
    serviceSelect.innerHTML = '';
    
    servicedBySelect.appendChild(new Option("Select Technician (Optional)", ""));
    STAFF_MEMBERS.forEach(staff => servicedBySelect.appendChild(new Option(staff, staff)));

    Object.entries(SALON_MENU.products).forEach(([name, price]) => {
        productSelect.appendChild(new Option(`${name} ($${price.toFixed(2)})`, name));
    });

    Object.entries(SALON_MENU.services).forEach(([name, price]) => {
        serviceSelect.appendChild(new Option(price === 0 ? name : `${name} (+$${price.toFixed(2)})`, name));
    });
}

async function initSupabase() {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { showDashboard(); } else { showLogin(); }
}

function showDashboard() {
    loginOverlay.style.display = 'none';
    appWorkspace.className = ''; // Remove hidden constraints
    appWorkspace.style.opacity = '1';
    appWorkspace.style.pointerEvents = 'auto';
    initFormElements();
}

function showLogin() {
    loginOverlay.style.display = 'flex';
    appWorkspace.style.opacity = '0';
    appWorkspace.style.pointerEvents = 'none';
}

loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    loginBtn.textContent = 'Verifying...';
    const { error } = await supabaseClient.auth.signInWithPassword({ email: loginEmail.value, password: loginPassword.value });
    if (error) {
        loginError.textContent = `❌ ${error.message}`;
        loginError.style.display = 'block';
        loginBtn.textContent = 'Sign In';
    } else { showDashboard(); }
});

logoutBtn.addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    showLogin();
});

// Calculator & Database Pipeline
receiptForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    submitBtn.textContent = 'Processing and Syncing...';

    const chosenStaff = servicedBySelect.value || null;
    
    const pName = productSelect.value;
    const pBasePrice = SALON_MENU.products[pName];
    const pQty = parseInt(productQtyInput.value) || 1;
    const pTotalPrice = pBasePrice * pQty;

    const sName = serviceSelect.value;
    const sBasePrice = SALON_MENU.services[sName];
    const sQty = parseInt(serviceQtyInput.value) || 1;
    const sTotalPrice = sBasePrice * sQty;
    
    const mPrice = parseFloat(miscInput.value) || 0.00;

    const subtotal = pTotalPrice + sTotalPrice + mPrice;
    const tax = subtotal * HST_RATE;
    const total = subtotal + tax;

    const receiptPayload = {
        product_name: pQty > 1 ? `${pName} (x${pQty})` : pName,
        product_price: pTotalPrice,
        service_name: sName === "None / No Add-on" ? sName : (sQty > 1 ? `${sName} (x${sQty})` : sName),
        service_price: sTotalPrice,
        misc_price: mPrice,
        subtotal: subtotal,
        tax: tax,
        total: total,
        serviced_by: chosenStaff
    };

    const { data, error } = await supabaseClient.from('receipts').insert([receiptPayload]).select();

    if (error) {
        alert('Cloud Storage Write Error: ' + error.message);
        submitBtn.textContent = 'Generate & Save Receipt';
    } else {
        document.getElementById('receiptDate').innerText = new Date(data[0].created_at).toLocaleString();
        
        const staffDisplay = document.getElementById('receiptStaff');
        if (data[0].serviced_by) {
            staffDisplay.innerText = `SERVICED BY: ${data[0].serviced_by}`;
            staffDisplay.style.display = 'block';
        } else { staffDisplay.style.display = 'none'; }
        
        let itemsHTML = `
            <div class="receipt-row">
                <span>${pName}${pQty > 1 ? ` <small style="color:#64748b;">x${pQty}</small>` : ''}</span>
                <span>$${pTotalPrice.toFixed(2)}</span>
            </div>
        `;
        
        if (sName !== "None / No Add-on") {
            itemsHTML += `
                <div class="receipt-row">
                    <span>${sName}${sQty > 1 ? ` <small style="color:#64748b;">x${sQty}</small>` : ''}</span>
                    <span>$${sTotalPrice.toFixed(2)}</span>
                </div>
            `;
        }
        
        if (mPrice > 0) {
            itemsHTML += `<div class="receipt-row"><span>Misc Amount</span><span>$${mPrice.toFixed(2)}</span></div>`;
        }
        
        document.getElementById('receiptItems').innerHTML = itemsHTML;
        document.getElementById('receiptSubtotal').innerText = `$${subtotal.toFixed(2)}`;
        document.getElementById('receiptTax').innerText = `$${tax.toFixed(2)}`;
        document.getElementById('receiptTotal').innerText = `$${total.toFixed(2)}`;

        placeholderText.style.display = 'none';
        receiptBox.style.display = 'block';
        submitBtn.textContent = 'Generate & Save Receipt';
        
        miscInput.value = '';
        productQtyInput.value = 1;
        serviceQtyInput.value = 1;
    }
});

window.addEventListener('load', initSupabase);
