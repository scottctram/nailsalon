const SUPABASE_URL = 'https://rdfxkunntwffxibaoqnk.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_lYXIa2nPYnpn6CGpPHNVEw_yDOp0P13';

const HST_RATE = 0.13;
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

// Target DOM nodes safely
const receiptForm = document.getElementById('receiptForm');
const masterStaffSelect = document.getElementById('masterStaff');
const miscInput = document.getElementById('miscInput');
const submitBtn = document.getElementById('submitBtn');
const receiptBox = document.getElementById('receiptBox');
const placeholderText = document.getElementById('placeholderText');

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginOverlay = document.getElementById('loginOverlay');
const appWorkspace = document.getElementById('appWorkspace');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// Counter array tracker to avoid row reference pollution
let totalRowCounter = 0;

function createCheckboxRow(containerId, itemMap) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    Object.entries(itemMap).forEach(([name, price]) => {
        const uniqueIndex = totalRowCounter++;
        const row = document.createElement('div');
        row.className = 'menu-item-row';
        
        row.innerHTML = `
            <input type="checkbox" id="check_${uniqueIndex}" class="service-checkbox" data-name="${name}" data-price="${price}">
            <label for="check_${uniqueIndex}">${name} ($${price.toFixed(2)})</label>
            
            <div class="controls-wrapper-box" id="wrapper_${uniqueIndex}">
                <div class="qty-input-wrapper">
                    <span>Qty:</span>
                    <input type="number" class="qty-field" id="qty_${uniqueIndex}" min="1" max="20" value="1">
                </div>
                <div class="staff-inline-wrapper">
                    <span>By:</span>
                    <select class="staff-inline-field" id="staff_${uniqueIndex}"></select>
                </div>
            </div>
        `;
        container.appendChild(row);

        const checkbox = row.querySelector('.service-checkbox');
        const controlsWrapper = row.querySelector('.controls-wrapper-box');
        const qtyField = row.querySelector('.qty-field');
        const inlineStaffSelect = row.querySelector('.staff-inline-field');

        // Populate the unique selection options inside this single line element
        inlineStaffSelect.appendChild(new Option("None (N/A)", ""));
        STAFF_MEMBERS.forEach(staff => inlineStaffSelect.appendChild(new Option(staff, staff)));

        // Live visual event listener tracking toggles
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                controlsWrapper.style.display = 'flex';
                if (masterStaffSelect) {
                    inlineStaffSelect.value = masterStaffSelect.value;
                }
            } else {
                controlsWrapper.style.display = 'none';
                qtyField.value = 1;
                inlineStaffSelect.value = "";
            }
        });
    });
}

function initFormElements() {
    if (masterStaffSelect) {
        masterStaffSelect.innerHTML = '';
        masterStaffSelect.appendChild(new Option("Select Technician (Default)", ""));
        STAFF_MEMBERS.forEach(staff => masterStaffSelect.appendChild(new Option(staff, staff)));
    }

    createCheckboxRow('nailServicesContainer', SALON_MENU.nails);
    createCheckboxRow('waxingServicesContainer', SALON_MENU.waxing);
    createCheckboxRow('otherServicesContainer', SALON_MENU.other);
}

function showDashboard() {
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (appWorkspace) {
        appWorkspace.className = 'app-workspace-visible';
    }
    initFormElements();
}

function showLogin() {
    if (loginOverlay) loginOverlay.style.display = 'flex';
    if (appWorkspace) {
        appWorkspace.className = 'app-workspace-hidden';
    }
}

async function initSupabase() {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) { showDashboard(); } else { showLogin(); }
    } catch (err) {
        console.error("Initialization check crashed:", err);
    }
}

// Security Logins
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!loginBtn) return;
        loginBtn.textContent = 'Verifying...';
        if (loginError) loginError.style.display = 'none';
        
        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ 
                email: loginEmail.value, 
                password: loginPassword.value 
            });
            if (error) {
                if (loginError) {
                    loginError.textContent = `❌ ${error.message}`;
                    loginError.style.display = 'block';
                }
                loginBtn.textContent = 'Sign In';
            } else { showDashboard(); }
        } catch(err) {
            loginBtn.textContent = 'Sign In';
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
        await supabaseClient.auth.signOut();
        showLogin();
    });
}

// Receipt Logic Runner Process Pipeline
if (receiptForm) {
    receiptForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const checkedBoxes = document.querySelectorAll('.service-checkbox:checked');
        const miscPrice = parseFloat(miscInput.value) || 0.00;

        if (checkedBoxes.length === 0 && miscPrice === 0) {
            alert('Please select at least one treatment box.');
            return;
        }

        if (submitBtn) submitBtn.textContent = 'Processing...';

        let subtotal = 0;
        let selectedItemsList = [];
        let receiptItemsHTML = '';
        let staffTrackerList = [];

        checkedBoxes.forEach(cb => {
            const name = cb.getAttribute('data-name');
            const price = parseFloat(cb.getAttribute('data-price'));
            
            // Extract suffix components accurately using parent node extraction queries
            const rowWrapper = cb.closest('.menu-item-row');
            const qtyField = rowWrapper.querySelector('.qty-field');
            const inlineStaffField = rowWrapper.querySelector('.staff-inline-field');
            
            const qty = parseInt(qtyField.value) || 1;
            const serviceStaff = inlineStaffField.value || null;
            
            const totalItemCost = price * qty;
            subtotal += totalItemCost;

            let descriptionEntry = qty > 1 ? `${name} (x${qty})` : name;
            if (serviceStaff) {
                descriptionEntry += ` [By: ${serviceStaff}]`;
                staffTrackerList.push(serviceStaff);
            }
            selectedItemsList.push(descriptionEntry);

            receiptItemsHTML += `
                <div class="receipt-row">
                    <span>${name}${qty > 1 ? ` <small style="color:#64748b;">x${qty}</small>` : ''}</span>
                    <span>$${totalItemCost.toFixed(2)}</span>
                </div>
            `;
            if (serviceStaff) {
                receiptItemsHTML += `<div class="receipt-staff-line">↳ Serviced By: ${serviceStaff}</div>`;
            }
        });

        if (miscPrice > 0) {
            subtotal += miscPrice;
            receiptItemsHTML += `<div class="receipt-row"><span>Misc Amount</span><span>$${miscPrice.toFixed(2)}</span></div>`;
            selectedItemsList.push(`Misc: $${miscPrice.toFixed(2)}`);
        }

        const tax = subtotal * HST_RATE;
        const total = subtotal + tax;

        const uniqueStaff = [...new Set(staffTrackerList)];
        const finalStaffString = uniqueStaff.length > 0 ? uniqueStaff.join(', ') : null;

        const receiptPayload = {
            product_name: selectedItemsList.join(', ').substring(0, 250),
            product_price: subtotal - miscPrice,
            service_name: "Multi-Selection Checkout",
            service_price: 0.00,
            misc_price: miscPrice,
            subtotal: subtotal,
            tax: tax,
            total: total,
            serviced_by: finalStaffString
        };

        try {
            const { data, error } = await supabaseClient.from('receipts').insert([receiptPayload]).select();
            if (error) throw error;

            document.getElementById('receiptDate').innerText = new Date(data[0].created_at).toLocaleString();
            document.getElementById('receiptItems').innerHTML = receiptItemsHTML;
            document.getElementById('receiptSubtotal').innerText = `$${subtotal.toFixed(2)}`;
            document.getElementById('receiptTax').innerText = `$${tax.toFixed(2)}`;
            document.getElementById('receiptTotal').innerText = `$${total.toFixed(2)}`;

            if (placeholderText) placeholderText.style.display = 'none';
            if (receiptBox) receiptBox.style.display = 'block';
            if (submitBtn) submitBtn.textContent = 'Generate & Save Receipt';
            
            // Wipe input selections back to clean baseline maps
            if (miscInput) miscInput.value = '';
            if (masterStaffSelect) masterStaffSelect.value = '';
            
            checkedBoxes.forEach(cb => {
                cb.checked = false;
                const wrapper = cb.closest('.menu-item-row');
                wrapper.querySelector('.controls-wrapper-box').style.display = 'none';
                wrapper.querySelector('.qty-field').value = 1;
                wrapper.querySelector('.staff-inline-field').value = "";
            });
        } catch (err) {
            alert('Database Transaction Error: ' + err.message);
            if (submitBtn) submitBtn.textContent = 'Generate & Save Receipt';
        }
    });
}

window.addEventListener('load', initSupabase);
