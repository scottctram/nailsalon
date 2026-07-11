const SUPABASE_URL = 'https://rdfxkunntwffxibaoqnk.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_lYXIa2nPYnpn6CGpPHNVEw_yDOp0P13';

const HST_RATE = 0.13;
const CASH_DISCOUNT_RATE = 0.10; // 10% Cash discount
const STAFF_MEMBERS = ['Anna', 'Kim', 'Rose', 'Maira', 'Yuzu', 'Komal', 'Ruby', 'Linda'];

// CATEGORIZED PRICING CATALOG DICTIONARY
const SALON_MENU = {
    nails: {
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
        "Finger Nails Trim": 10.00,
        "Toe Nails Trim": 10.00
    },
    waxing: {
        "Waxing: Eyebrows": 8.00,
        "Waxing: Upper lips": 5.00,
        "Waxing: Chin": 6.00,
        "Waxing: Full face": 25.00,
        "Waxing: Under arms": 10.00,
        "Waxing: Full arms": 30.00,
        "Waxing: Half arms": 20.00,
        "Waxing: Full legs": 40.00,
        "Waxing: Half legs": 25.00,
        "Waxing: Chest": 20.00,
        "Waxing: Back": 35.00,
        "Waxing: Bikini": 20.00,
        "Waxing: Brazilian": 40.00,
        "Waxing: Full body": 130.00,
        "Threading: Eyebrows": 8.00,
        "Threading: Upper lips": 5.00,
        "Threading: Chin": 6.00,
        "Threading: Full face": 30.00
    },
    other: {
        "French Finish Add-on": 10.00,
        "Design Add-on": 5.00,
        "Chrome Add-on": 10.00,
        "Ombre Add-on": 15.00,
        "Extra Length Add-on": 5.00,
        "Take Off Shellac Add-on": 5.00,
        "Shellac Removal Service": 7.00,
        "Artificial Nail Removal": 17.00,
        "Eyelash: Single (One by One)": 75.00,
        "Eyelash: Refill Single Lashes": 50.00,
        "Eyelash: Strip Lashes": 15.00,
        "Eyelash: Individual Lashes": 40.00,
        "Lash Lift": 25.00,
        "Eyebrow/Eyelash Tinting": 10.00,
        "Facial Treatment": 45.00
    }
};

let supabaseClient = null;
let computedFormTotal = 0; // Track final total for dynamic live change calculations

// Document Nodes
const receiptForm = document.getElementById('receiptForm');
const servicedBySelect = document.getElementById('servicedBy');
const miscInput = document.getElementById('miscInput');
const submitBtn = document.getElementById('submitBtn');
const receiptBox = document.getElementById('receiptBox');
const placeholderText = document.getElementById('placeholderText');

// Payment DOM elements
const cashCalculatorGroup = document.getElementById('cashCalculatorGroup');
const cashTenderedInput = document.getElementById('cashTendered');
const liveChangeDueDisplay = document.getElementById('liveChangeDue');

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginOverlay = document.getElementById('loginOverlay');
const appWorkspace = document.getElementById('appWorkspace');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// Generates structural interactive input rows dynamically
function createCheckboxRow(containerId, itemMap) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    let index = 0;
    Object.entries(itemMap).forEach(([name, price]) => {
        const uniqueId = `${containerId}_item_${index++}`;
        const row = document.createElement('div');
        row.className = 'menu-item-row';
        row.innerHTML = `
            <input type="checkbox" id="${uniqueId}" data-name="${name}" data-price="${price}" class="service-checkbox">
            <label for="${uniqueId}">${name} ($${price.toFixed(2)})</label>
            <div class="qty-input-wrapper" id="wrapper_${uniqueId}">
                <span>Qty:</span>
                <input type="number" class="qty-field" id="qty_${uniqueId}" min="1" max="20" value="1">
            </div>
        `;
        container.appendChild(row);

        const checkbox = row.querySelector('input[type="checkbox"]');
        const qtyWrapper = row.querySelector('.qty-input-wrapper');
        const qtyField = row.querySelector('.qty-field');

        checkbox.addEventListener('change', function() {
            if (this.checked) {
                qtyWrapper.classList.add('active');
            } else {
                qtyWrapper.classList.remove('active');
                qtyField.value = 1;
            }
            calculateLiveTotals(); // Recalculate totals immediately when selections change
        });
        qtyField.addEventListener('input', calculateLiveTotals);
    });
}

function initFormElements() {
    servicedBySelect.innerHTML = '';
    servicedBySelect.appendChild(new Option("Select Technician (Optional)", ""));
    STAFF_MEMBERS.forEach(staff => servicedBySelect.appendChild(new Option(staff, staff)));

    createCheckboxRow('nailServicesContainer', SALON_MENU.nails);
    createCheckboxRow('waxingServicesContainer', SALON_MENU.waxing);
    createCheckboxRow('otherServicesContainer', SALON_MENU.other);
}

// Live calculation engine to compute cash changes as your brother types them
function calculateLiveTotals() {
    const checkedBoxes = document.querySelectorAll('.service-checkbox:checked');
    const miscPrice = parseFloat(miscInput.value) || 0.00;
    const isCash = document.querySelector('input[name="paymentMethod"]:checked').value === 'Cash';

    let subtotal = 0;
    checkedBoxes.forEach(cb => {
        const price = parseFloat(cb.getAttribute('data-price'));
        const qtyField = document.getElementById(`qty_${cb.id}`);
        const qty = parseInt(qtyField.value) || 1;
        subtotal += price * qty;
    });
    subtotal += miscPrice;

    // Apply the conditional 10% Cash discount on the subtotal
    const discount = isCash ? (subtotal * CASH_DISCOUNT_RATE) : 0;
    const subtotalAfterDiscount = subtotal - discount;
    const tax = subtotalAfterDiscount * HST_RATE;
    
    computedFormTotal = subtotalAfterDiscount + tax;

    // Update Change Due box live
    if (isCash) {
        const tendered = parseFloat(cashTenderedInput.value) || 0;
        const changeDue = Math.max(0, tendered - computedFormTotal);
        liveChangeDueDisplay.textContent = `$${changeDue.toFixed(2)}`;
        liveChangeDueDisplay.style.color = tendered >= computedFormTotal ? '#16a34a' : '#dc2626';
    }
}

// Payment Option Toggle Listeners
document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'Cash') {
            cashCalculatorGroup.style.display = 'block';
        } else {
            cashCalculatorGroup.style.display = 'none';
            cashTenderedInput.value = '';
        }
        calculateLiveTotals();
    });
});
miscInput.addEventListener('input', calculateLiveTotals);
cashTenderedInput.addEventListener('input', calculateLiveTotals);

function showDashboard() {
    loginOverlay.style.display = 'none';
    appWorkspace.className = 'app-workspace-visible';
    initFormElements();
}

function showLogin() {
    loginOverlay.style.display = 'flex';
    appWorkspace.className = 'app-workspace-hidden';
}

async function initSupabase() {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) { showDashboard(); } else { showLogin(); }
    } catch (err) {
        console.error("Supabase initialization crash intercepted:", err);
    }
}

// Security Session Listeners
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    loginBtn.textContent = 'Verifying...';
    loginError.style.display = 'none';
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email: loginEmail.value, password: loginPassword.value });
        if (error) {
            loginError.textContent = `❌ ${error.message}`;
            loginError.style.display = 'block';
            loginBtn.textContent = 'Sign In';
        } else { showDashboard(); }
    } catch(err) {
        loginBtn.textContent = 'Sign In';
    }
});

logoutBtn.addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    showLogin();
});

// POS calculation pipeline loop
receiptForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const checkedBoxes = document.querySelectorAll('.service-checkbox:checked');
    const miscPrice = parseFloat(miscInput.value) || 0.00;

    if (checkedBoxes.length === 0 && miscPrice === 0) {
        alert('Please select at least one check item from the service list.');
        return;
    }

    const payMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const tenderedAmount = parseFloat(cashTenderedInput.value) || 0;

    if (payMethod === 'Cash' && tenderedAmount < computedFormTotal) {
        alert(`Insufficient cash entered. Total required is $${computedFormTotal.toFixed(2)}`);
        return;
    }

    submitBtn.textContent = 'Processing and Syncing...';
    const chosenStaff = servicedBySelect.value || null;

    let subtotal = 0;
    let selectedItemsList = [];
    let receiptItemsHTML = '';

    checkedBoxes.forEach(cb => {
        const name = cb.getAttribute('data-name');
        const price = parseFloat(cb.getAttribute('data-price'));
        const qtyField = document.getElementById(`qty_${cb.id}`);
        const qty = parseInt(qtyField.value) || 1;
        const totalItemCost = price * qty;

        subtotal += totalItemCost;
        selectedItemsList.push(qty > 1 ? `${name} (x${qty})` : name);

        receiptItemsHTML += `
            <div class="receipt-row">
                <span>${name}${qty > 1 ? ` <small style="color:#64748b;">x${qty}</small>` : ''}</span>
                <span>$${totalItemCost.toFixed(2)}</span>
            </div>
        `;
    });

    if (miscPrice > 0) {
        subtotal += miscPrice;
        receiptItemsHTML += `
            <div class="receipt-row">
                <span>Misc Amount</span>
                <span>$${miscPrice.toFixed(2)}</span>
            </div>
        `;
        selectedItemsList.push(`Misc: $${miscPrice.toFixed(2)}`);
    }

    // Calculation Matrix Stack
    const cashDiscount = payMethod === 'Cash' ? (subtotal * CASH_DISCOUNT_RATE) : 0;
    const netSubtotal = subtotal - cashDiscount;
    const tax = netSubtotal * HST_RATE;
    const finalTotal = netSubtotal + tax;
    const changeDue = payMethod === 'Cash' ? (tenderedAmount - finalTotal) : 0;

    // Append payment profile directly onto audit summaries for lookups
    selectedItemsList.push(`[Paid by ${payMethod}]`);

    const receiptPayload = {
        product_name: selectedItemsList.join(', ').substring(0, 250),
        product_price: subtotal - miscPrice,
        service_name: `Multi-Selection Checkout (${payMethod})`,
        service_price: 0.00,
        misc_price: miscPrice,
        subtotal: subtotal,
        tax: tax,
        total: finalTotal,
        serviced_by: chosenStaff
    };

    try {
        const { data, error } = await supabaseClient.from('receipts').insert([receiptPayload]).select();
        if (error) throw error;

        document.getElementById('receiptDate').innerText = new Date(data[0].created_at).toLocaleString();
        
        const staffDisplay = document.getElementById('receiptStaff');
        if (data[0].serviced_by) {
            staffDisplay.innerText = `SERVICED BY: ${data[0].serviced_by}`;
            staffDisplay.style.display = 'block';
        } else { staffDisplay.style.display = 'none'; }
        
        // Render Line Items and Discounts on Receipt Canvas
        document.getElementById('receiptItems').innerHTML = receiptItemsHTML;
        document.getElementById('receiptSubtotal').innerText = `$${subtotal.toFixed(2)}`;
        
        const discountRow = document.getElementById('discountReceiptRow');
        if (cashDiscount > 0) {
            document.getElementById('receiptDiscount').innerText = `-$${cashDiscount.toFixed(2)}`;
            discountRow.style.display = 'flex';
        } else {
            discountRow.style.display = 'none';
        }

        document.getElementById('receiptTax').innerText = `$${tax.toFixed(2)}`;
        document.getElementById('receiptTotal').innerText = `$${finalTotal.toFixed(2)}`;

        // Handle Cash change return breakdown rows
        const receiptCashDetails = document.getElementById('receiptCashDetails');
        if (payMethod === 'Cash') {
            document.getElementById('receiptTendered').innerText = `$${tenderedAmount.toFixed(2)}`;
            document.getElementById('receiptChange').innerText = `$${changeDue.toFixed(2)}`;
            receiptCashDetails.style.display = 'block';
        } else {
            receiptCashDetails.style.display = 'none';
        }

        placeholderText.style.display = 'none';
        receiptBox.style.display = 'block';
        submitBtn.textContent = 'Generate & Save Receipt';
        
        // Reset states cleanly back to zero configurations
        miscInput.value = '';
        cashTenderedInput.value = '';
        document.getElementById('cashCalculatorGroup').style.display = 'none';
        document.querySelector('input[name="paymentMethod"][value="Card"]').checked = true;
        
        checkedBoxes.forEach(cb => {
            cb.checked = false;
            document.getElementById(`wrapper_${cb.id}`).classList.remove('active');
            document.getElementById(`qty_${cb.id}`).value = 1;
        });
    } catch (err) {
        alert('Database Sync Error: ' + err.message);
        submitBtn.textContent = 'Generate & Save Receipt';
    }
});

window.addEventListener('load', initSupabase);
