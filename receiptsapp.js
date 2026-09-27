const SUPABASE_URL = 'https://rdfxkunntwffxibaoqnk.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_lYXIa2nPYnpn6CGpPHNVEw_yDOp0P13';

const HST_RATE = 0.13;
const STAFF_MEMBERS = ['Anna', 'Kim', 'Rose', 'Maira', 'Yuzu', 'Komal', 'Ruby', 'Linda', 'Hafsa', 'Love'];

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
        "Finger Nails Trim": 7.00,
        "Toe Nails Trim": 10.00
    },
    waxing: {
        "Waxing: Eyebrows": 8.00,
        "Waxing: Forehead": 6.00,
        "Waxing: Upper lips": 6.00,
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
        "Threading: Forehead": 6.00,
        "Threading: Upper lips": 6.00,
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
        "Shellac Removal & Nails Trim": 14.00,
        "Artificial Nail Removal": 20.00,
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
let currentReceiptId = null; 
let activeReceiptCache = null; 
let finalBillTotalValue = 0; 

// Document Nodes
const receiptForm = document.getElementById('receiptForm');
const servicedBySelect = document.getElementById('servicedBy');
const miscNameInput = document.getElementById('miscNameInput');
const miscInput = document.getElementById('miscInput');
const submitBtn = document.getElementById('submitBtn');
const resetFormBtn = document.getElementById('resetFormBtn');
const receiptBox = document.getElementById('receiptBox');
const placeholderText = document.getElementById('placeholderText');

// Payment & Loyalty Nodes
const cashCalculatorGroup = document.getElementById('cashCalculatorGroup');
const cashTenderedInput = document.getElementById('cashTendered');
const liveChangeDueLabel = document.getElementById('changeDueLabel');
const liveChangeDueDisplay = document.getElementById('liveChangeDue');
const loyaltyAdjustmentBox = document.getElementById('loyaltyAdjustmentBox');
const giftCardAmountInput = document.getElementById('giftCardAmount');
const loyaltyPercentInput = document.getElementById('loyaltyPercent');
const applyLoyaltyBtn = document.getElementById('applyLoyaltyBtn');
const receiptActionToolbar = document.getElementById('receiptActionToolbar');
const printReceiptBtn = document.getElementById('printReceiptBtn');

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginOverlay = document.getElementById('loginOverlay');
const appWorkspace = document.getElementById('appWorkspace');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

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
            calculateLiveTotals();
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

function calculateLiveTotals() {
    const checkedBoxes = document.querySelectorAll('.service-checkbox:checked');
    const miscPrice = parseFloat(miscInput.value) || 0.00;
    const isCash = document.querySelector('input[name="paymentMethod"]:checked').value === 'Cash';

    let baseSubtotal = 0;
    checkedBoxes.forEach(cb => {
        const price = parseFloat(cb.getAttribute('data-price'));
        const qtyField = document.getElementById(`qty_${cb.id}`);
        const qty = parseInt(qtyField.value) || 1;
        baseSubtotal += price * qty;
    });
    baseSubtotal += miscPrice;

    const baseTax = baseSubtotal * HST_RATE;
    const baseTotal = baseSubtotal + baseTax;

    const currentActiveTotal = currentReceiptId ? finalBillTotalValue : baseTotal;

    if (isCash) {
        const tendered = parseFloat(cashTenderedInput.value) || 0;
        const diff = tendered - currentActiveTotal;

        if (diff >= 0) {
            if (liveChangeDueLabel) liveChangeDueLabel.textContent = 'Change Due';
            liveChangeDueDisplay.textContent = `$${diff.toFixed(2)}`;
            liveChangeDueDisplay.style.color = '#16a34a';
        } else {
            const stillOwed = Math.abs(diff);
            if (liveChangeDueLabel) liveChangeDueLabel.textContent = 'Still Owed';
            liveChangeDueDisplay.textContent = `-$${stillOwed.toFixed(2)}`;
            liveChangeDueDisplay.style.color = '#dc2626';
        }
        
        if (document.getElementById('receiptBox').style.display === 'block') {
            document.getElementById('receiptTendered').innerText = `$${tendered.toFixed(2)}`;
            const changeDisplayEl = document.getElementById('receiptChange');
            const changeLabelEl = document.getElementById('receiptChangeLabel');

            if (diff >= 0) {
                changeDisplayEl.innerText = `$${diff.toFixed(2)}`;
                changeDisplayEl.style.color = '#166534';
                if (changeLabelEl) changeLabelEl.innerText = 'CHANGE RETURNED:';
            } else {
                changeDisplayEl.innerText = `-$${Math.abs(diff).toFixed(2)}`;
                changeDisplayEl.style.color = '#dc2626';
                if (changeLabelEl) changeLabelEl.innerText = 'STILL OWED:';
            }
        }
    }
}

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
if (miscNameInput) miscNameInput.addEventListener('input', calculateLiveTotals);
cashTenderedInput.addEventListener('input', calculateLiveTotals);

function handleFormReset() {
    if (miscNameInput) miscNameInput.value = '';
    miscInput.value = '';
    cashTenderedInput.value = '';
    servicedBySelect.value = '';
    if (giftCardAmountInput) giftCardAmountInput.value = '';
    loyaltyPercentInput.value = '';
    
    // Default to Cash
    document.querySelector('input[name="paymentMethod"][value="Cash"]').checked = true;
    document.getElementById('cashCalculatorGroup').style.display = 'block';
    
    const checkboxes = document.querySelectorAll('.service-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
        document.getElementById(`wrapper_${cb.id}`).classList.remove('active');
        document.getElementById(`qty_${cb.id}`).value = 1;
    });
    
    currentReceiptId = null;
    activeReceiptCache = null;
    finalBillTotalValue = 0;
    
    // Reset Discount DOM Nodes
    const discountRow = document.getElementById('discountReceiptRow');
    const discountLabel = document.getElementById('discountReceiptLabel');
    const discountValue = document.getElementById('receiptDiscount');
    
    if (discountRow) discountRow.style.display = 'none';
    if (discountLabel) discountLabel.textContent = 'DISCOUNT:';
    if (discountValue) discountValue.textContent = '-$0.00';

    // Reset Gift Card DOM Nodes
    const giftCardRow = document.getElementById('giftCardReceiptRow');
    const giftCardLabel = document.getElementById('giftCardReceiptLabel');
    const giftCardValue = document.getElementById('receiptGiftCard');
    const giftCardBalanceRow = document.getElementById('giftCardBalanceRow');
    const giftCardBalance = document.getElementById('receiptGiftCardBalance');
    
    if (giftCardRow) giftCardRow.style.display = 'none';
    if (giftCardLabel) giftCardLabel.textContent = 'GIFT CARD REDEEMED:';
    if (giftCardBalanceRow) giftCardBalanceRow.style.display = 'none';
    if (giftCardValue) giftCardValue.textContent = '-$0.00';
    if (giftCardBalance) giftCardBalance.textContent = '$0.00';

    // Clear Cash Details Display
    document.getElementById('receiptCashDetails').style.display = 'none';
    document.getElementById('receiptTendered').innerText = '$0.00';
    
    const receiptChange = document.getElementById('receiptChange');
    receiptChange.innerText = '$0.00';
    receiptChange.style.color = '#166534';
    
    const receiptChangeLabel = document.getElementById('receiptChangeLabel');
    if (receiptChangeLabel) receiptChangeLabel.innerText = 'CHANGE RETURNED:';

    receiptBox.style.display = 'none';
    loyaltyAdjustmentBox.style.display = 'none';
    receiptActionToolbar.style.display = 'none';
    placeholderText.style.display = 'block';

    if (liveChangeDueLabel) liveChangeDueLabel.textContent = 'Change Due';
    liveChangeDueDisplay.textContent = '$0.00';
    liveChangeDueDisplay.style.color = '#16a34a';
}
resetFormBtn.addEventListener('click', handleFormReset);

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

loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    loginBtn.textContent = 'Verifying...';
    loginError.style.display = 'none';
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

// PRIMARY INVOICE GENERATOR PIPELINE
receiptForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const checkedBoxes = document.querySelectorAll('.service-checkbox:checked');
    const miscPrice = parseFloat(miscInput.value) || 0.00;
    const customMiscName = miscNameInput && miscNameInput.value.trim() !== '' 
        ? miscNameInput.value.trim() 
        : "Misc Amount";

    if (checkedBoxes.length === 0 && miscPrice === 0) {
        alert('Please select at least one check item from the service list or enter a custom amount.');
        return;
    }

    submitBtn.textContent = 'Processing and Syncing...';
    const payMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
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
        receiptItemsHTML += `<div class="receipt-row"><span>${customMiscName}</span><span>$${miscPrice.toFixed(2)}</span></div>`;
        selectedItemsList.push(`${customMiscName}: $${miscPrice.toFixed(2)}`);
    }

    const tax = subtotal * HST_RATE;
    const total = subtotal + tax;
    finalBillTotalValue = total;

    activeReceiptCache = {
        subtotal: subtotal,
        tax: tax,
        miscPrice: miscPrice,
        receiptItemsHTML: receiptItemsHTML,
        chosenStaff: chosenStaff,
        payMethod: payMethod,
        itemsSummaryString: selectedItemsList.join(', ')
    };

    const receiptPayload = {
        product_name: activeReceiptCache.itemsSummaryString.substring(0, 210) + ` [${payMethod}]`,
        product_price: subtotal - miscPrice,
        service_name: "Multi-Selection Checkout",
        service_price: 0.00,
        misc_price: miscPrice,
        subtotal: subtotal,
        tax: tax,
        total: total,
        serviced_by: chosenStaff
    };

    try {
        const { data, error } = await supabaseClient.from('receipts').insert([receiptPayload]).select();
        if (error) throw error;

        currentReceiptId = data[0].id;

        document.getElementById('receiptDate').innerText = new Date(data[0].created_at).toLocaleString();
        
        const staffDisplay = document.getElementById('receiptStaff');
        if (data[0].serviced_by) {
            staffDisplay.innerText = `SERVICED BY: ${data[0].serviced_by}`;
            staffDisplay.style.display = 'block';
        } else { staffDisplay.style.display = 'none'; }

        document.getElementById('receiptItems').innerHTML = receiptItemsHTML;
        document.getElementById('receiptSubtotal').innerText = `$${subtotal.toFixed(2)}`;
        
        // Reset rows on generate
        document.getElementById('giftCardReceiptRow').style.display = 'none';
        document.getElementById('giftCardBalanceRow').style.display = 'none';
        document.getElementById('discountReceiptRow').style.display = 'none'; 
        document.getElementById('receiptTax').innerText = `$${tax.toFixed(2)}`;
        document.getElementById('receiptTotal').innerText = `$${total.toFixed(2)}`;

        const receiptCashDetails = document.getElementById('receiptCashDetails');
        if (payMethod === 'Cash') {
            const tendered = parseFloat(cashTenderedInput.value) || 0;
            const diff = tendered - total;
            document.getElementById('receiptTendered').innerText = `$${tendered.toFixed(2)}`;
            const changeDisplayEl = document.getElementById('receiptChange');
            const changeLabelEl = document.getElementById('receiptChangeLabel');

            if (diff >= 0) {
                changeDisplayEl.innerText = `$${diff.toFixed(2)}`;
                changeDisplayEl.style.color = '#166534';
                if (changeLabelEl) changeLabelEl.innerText = 'CHANGE RETURNED:';
            } else {
                changeDisplayEl.innerText = `-$${Math.abs(diff).toFixed(2)}`;
                changeDisplayEl.style.color = '#dc2626';
                if (changeLabelEl) changeLabelEl.innerText = 'STILL OWED:';
            }
            receiptCashDetails.style.display = 'block';
        } else { receiptCashDetails.style.display = 'none'; }

        placeholderText.style.display = 'none';
        receiptBox.style.display = 'block';
        loyaltyAdjustmentBox.style.display = 'block'; 
        receiptActionToolbar.style.display = 'flex';   
        submitBtn.textContent = 'Generate & Save';
    } catch (err) {
        alert('Storage Sync Failure Error: ' + err.message);
        submitBtn.textContent = 'Generate & Save';
    }
});

applyLoyaltyBtn.addEventListener('click', async function() {
    if (!currentReceiptId || !activeReceiptCache) return;

    const baseSubtotal = activeReceiptCache.subtotal;
    const baseTax = activeReceiptCache.tax;
    const baseWithTax = baseSubtotal + baseTax;

    let discountPercent = parseFloat(loyaltyPercentInput.value) || 0;

    // Rule 1: Discount blocked if total before discounts is less than $15
    if (discountPercent > 0 && baseWithTax < 15.00) {
        alert('Discounts cannot be applied to orders under $15.00.');
        loyaltyPercentInput.value = '';
        discountPercent = 0;
        return;
    }

    // Rule 2: Discount cannot exceed 20%, reset to 0 if exceeded
    if (discountPercent > 20) {
        alert('Discount cannot exceed 20%. The discount has been reset to 0%.');
        discountPercent = 0;
        loyaltyPercentInput.value = '';
    }

    applyLoyaltyBtn.textContent = 'Updating...';
    
    const giftCard = parseFloat(giftCardAmountInput.value) || 0;

    // Amount deducted from the bill by the gift card cannot exceed the bill itself
    const appliedGiftCardDeduction = Math.min(baseWithTax, giftCard);
    
    // Remaining unused Gift Card balance
    const remainingGiftCardBalance = Math.max(0, giftCard - baseWithTax);

    // Bill remaining after gift card application
    const afterGiftCard = Math.max(0, baseWithTax - giftCard);
    
    // Discount percentage applied on remaining balance
    const discountDeduction = afterGiftCard * (discountPercent / 100);
    const updatedTotal = Math.max(0, afterGiftCard - discountDeduction);
    
    finalBillTotalValue = updatedTotal; 

    // Build item tracking string
    let adjustmentTags = [];
    if (giftCard > 0) {
        adjustmentTags.push(`GC ($${giftCard % 1 === 0 ? giftCard : giftCard.toFixed(2)}): -$${appliedGiftCardDeduction.toFixed(2)}`);
        if (remainingGiftCardBalance > 0) {
            adjustmentTags.push(`GC Rem: $${remainingGiftCardBalance.toFixed(2)}`);
        }
    }
    if (discountPercent > 0) adjustmentTags.push(`Disc: ${discountPercent}%`);
    const tagSummary = adjustmentTags.length > 0 ? ` [${adjustmentTags.join(', ')}]` : '';

    const updatedPayload = {
        product_name: `${activeReceiptCache.itemsSummaryString}${tagSummary} [${activeReceiptCache.payMethod}]`.substring(0, 250),
        subtotal: baseSubtotal,
        tax: baseTax,
        total: updatedTotal
    };

    try {
        const { error } = await supabaseClient.from('receipts').update(updatedPayload).eq('id', currentReceiptId);
        if (error) throw error;

        // Display applied Gift Card amount and Remaining Balance
        const giftCardRow = document.getElementById('giftCardReceiptRow');
        const giftCardLabel = document.getElementById('giftCardReceiptLabel');
        const giftCardBalanceRow = document.getElementById('giftCardBalanceRow');
        
        if (giftCard > 0) {
            const formattedInputGC = giftCard % 1 === 0 ? giftCard : giftCard.toFixed(2);
            if (giftCardLabel) {
                giftCardLabel.textContent = `GIFT CARD ($${formattedInputGC}) REDEEMED:`;
            }
            document.getElementById('receiptGiftCard').textContent = `-$${appliedGiftCardDeduction.toFixed(2)}`;
            giftCardRow.style.display = 'flex';
            
            if (remainingGiftCardBalance > 0) {
                document.getElementById('receiptGiftCardBalance').textContent = `$${remainingGiftCardBalance.toFixed(2)}`;
                giftCardBalanceRow.style.display = 'flex';
            } else {
                giftCardBalanceRow.style.display = 'none';
            }
        } else {
            giftCardRow.style.display = 'none';
            giftCardBalanceRow.style.display = 'none';
        }

        // Conditional display for Discount
        const discountRow = document.getElementById('discountReceiptRow');
        if (discountPercent > 0) {
            document.getElementById('discountReceiptLabel').textContent = `DISCOUNT (${discountPercent}%):`;
            document.getElementById('receiptDiscount').textContent = `-$${discountDeduction.toFixed(2)}`;
            discountRow.style.display = 'flex';
        } else {
            discountRow.style.display = 'none';
        }

        document.getElementById('receiptTax').textContent = `$${baseTax.toFixed(2)}`;
        document.getElementById('receiptTotal').textContent = `$${updatedTotal.toFixed(2)}`;

        // Cash Tendered & Change / Still Owed handling
        const receiptCashDetails = document.getElementById('receiptCashDetails');
        if (activeReceiptCache.payMethod === 'Cash') {
            const tendered = parseFloat(cashTenderedInput.value) || 0;
            const diff = tendered - updatedTotal;
            document.getElementById('receiptTendered').innerText = `$${tendered.toFixed(2)}`;
            const changeDisplayEl = document.getElementById('receiptChange');
            const changeLabelEl = document.getElementById('receiptChangeLabel');

            if (diff >= 0) {
                changeDisplayEl.innerText = `$${diff.toFixed(2)}`;
                changeDisplayEl.style.color = '#166534';
                if (changeLabelEl) changeLabelEl.innerText = 'CHANGE RETURNED:';
                if (liveChangeDueLabel) liveChangeDueLabel.textContent = 'Change Due';
                liveChangeDueDisplay.textContent = `$${diff.toFixed(2)}`;
                liveChangeDueDisplay.style.color = '#16a34a';
            } else {
                const stillOwed = Math.abs(diff);
                changeDisplayEl.innerText = `-$${stillOwed.toFixed(2)}`;
                changeDisplayEl.style.color = '#dc2626';
                if (changeLabelEl) changeLabelEl.innerText = 'STILL OWED:';
                if (liveChangeDueLabel) liveChangeDueLabel.textContent = 'Still Owed';
                liveChangeDueDisplay.textContent = `-$${stillOwed.toFixed(2)}`;
                liveChangeDueDisplay.style.color = '#dc2626';
            }
        }

        applyLoyaltyBtn.textContent = 'Apply & Update Bill';
        alert(`Success! Adjustments applied securely to receipt record #${currentReceiptId}.`);
    } catch (err) {
        alert('Database Row Alteration Failure: ' + err.message);
        applyLoyaltyBtn.textContent = 'Apply & Update Bill';
    }
});

printReceiptBtn.addEventListener('click', () => {
    window.print();
});

window.addEventListener('load', initSupabase);
