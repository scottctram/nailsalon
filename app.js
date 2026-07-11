const SUPABASE_URL = 'https://rdfxkunntwffxibaoqnk.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_lYXIa2nPYnpn6CGpPHNVEw_yDOp0P13';

// Core Application Configurations
const SERVICES = { 
    'Gel Manicure': 45, 
    'Pedicure': 60, 
    'Acrylic Full Set': 90, 
    'Nail Art Removal': 15,
    'Other (Custom)': 0 
};
const STAFF_MEMBERS = ['Anna', 'Kim', 'Rose', 'Maira', 'Yuzu', 'Komal', 'Ruby', 'Linda'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
const START_HOUR = 9;

// State Memory Cache
let appointments = [];
let forceConfirmActive = false;
let supabaseClient = null;
let editingId = null;

// Document Selector Nodes
const form = document.getElementById('bookingForm');
const dateInput = document.getElementById('appointmentDate');
const customerInput = document.getElementById('customer');
const staffSelect = document.getElementById('staff');
const serviceSelect = document.getElementById('service');
const startTimeInput = document.getElementById('startTime');
const durationPreview = document.getElementById('durationPreview');
const warningBanner = document.getElementById('warningBanner');
const submitBtn = document.getElementById('submitBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const calendarHeader = document.getElementById('calendarHeader');
const timeColumn = document.getElementById('timeColumn');
const staffTrackContainer = document.getElementById('staffTrackContainer');
const calendarScrollWindow = document.getElementById('calendarScrollWindow');
const notesInput = document.getElementById('notes');
const customDurationGroup = document.getElementById('customDurationGroup');
const customDurationInput = document.getElementById('customDuration');

// Authentication DOM Intercept elements
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginOverlay = document.getElementById('loginOverlay');
const appWorkspace = document.getElementById('appWorkspace');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize Dynamic HTML Dropdowns & Matrix Columns
function initFormElements() {
    if(!dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Clear out setup duplicates before populating
    staffSelect.innerHTML = '';
    serviceSelect.innerHTML = '';
    timeColumn.innerHTML = '';
    
    Object.keys(SERVICES).forEach(s => serviceSelect.appendChild(new Option(`${s} (${SERVICES[s]} min)`, s)));
    HOURS.forEach(h => timeColumn.appendChild(Object.assign(document.createElement('div'), {className: 'time-slot', textContent: h})));
    
    STAFF_MEMBERS.forEach(s => { 
        staffSelect.appendChild(new Option(s, s)); 
    });
}

// Re-render the calendar top header cell array with block toggles
function updateCalendarHeaderUI() {
    calendarHeader.innerHTML = '<div class="header-cell" style="font-size: 0.85em;">Timeline</div>';
    
    STAFF_MEMBERS.forEach(staffName => {
        const cell = document.createElement('div');
        cell.className = 'header-cell';
        
        // Count regular bookings for this person today (exclude blocks)
        const activeBookings = appointments.filter(a => 
            a.date === dateInput.value && 
            a.staff === staffName && 
            a.customer !== 'STAFF_BLOCKED'
        );
        
        const isBlocked = appointments.some(a => 
            a.date === dateInput.value && 
            a.staff === staffName && 
            a.customer === 'STAFF_BLOCKED'
        );
        
        const titleText = document.createElement('div');
        titleText.textContent = staffName;
        cell.appendChild(titleText);
        
        const blockBtn = document.createElement('button');
        blockBtn.type = 'button';
        blockBtn.className = 'btn-block-header';
        
        if (isBlocked) {
            blockBtn.textContent = 'Unblock';
            blockBtn.classList.add('is-blocked');
        } else {
            blockBtn.textContent = 'Block';
        }
        
        // Disable blocking if there are active bookings
        if (activeBookings.length > 0) {
            blockBtn.disabled = true;
            blockBtn.title = 'Cannot block: Technician already has appointments scheduled today.';
        } else {
            blockBtn.title = isBlocked ? 'Make technician available' : 'Block technician off for the day';
        }
        
        blockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStaffBlock(staffName, isBlocked);
        });
        
        cell.appendChild(blockBtn);
        calendarHeader.appendChild(cell);
    });
}

// Action utility pipeline to write or remove blocker transactions from Supabase
async function toggleStaffBlock(staffName, wasBlocked) {
    const activeDate = dateInput.value;
    
    if (!wasBlocked) {
        const payload = {
            date: activeDate,
            customer: 'STAFF_BLOCKED',
            staff: staffName,
            service: 'Day Off',
            start_time: '09:00',
            end_time: '21:00',
            notes: 'System level column block overlay auto-lock'
        };
        const { data, error } = await supabaseClient.from('appointments').insert([payload]).select();
        if (!error) {
            appointments.push(data[0]);
            renderCalendarGrid();
            updateFormUI();
        }
    } else {
        const targetBlock = appointments.find(a => a.date === activeDate && a.staff === staffName && a.customer === 'STAFF_BLOCKED');
        if (targetBlock) {
            const { error } = await supabaseClient.from('appointments').delete().eq('id', targetBlock.id);
            if (!error) {
                appointments = appointments.filter(a => a.id !== targetBlock.id);
                renderCalendarGrid();
                updateFormUI();
            }
        }
    }
}

// Calculate Accurate Service End Boundary Windows
function calculateEndTime(start, serviceName) {
    const duration = serviceName === 'Other (Custom)' 
        ? (parseInt(customDurationInput.value) || 0) 
        : SERVICES[serviceName];
        
    const [hours, minutes] = start.split(':').map(Number);
    const total = hours * 60 + minutes + duration;
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

// Conflict Segment Interception Algorithm
function checkConflict() {
    const currentDate = dateInput.value;
    const currentStaff = staffSelect.value;
    const currentStartStr = startTimeInput.value;
    if (!currentStartStr || !currentDate) return false;

    const currentEndStr = calculateEndTime(currentStartStr, serviceSelect.value);
    const newStart = parseFloat(currentStartStr.split(':')[0]) + parseFloat(currentStartStr.split(':')[1]) / 60;
    const newEnd = parseFloat(currentEndStr.split(':')[0]) + parseFloat(currentEndStr.split(':')[1]) / 60;

    return appointments.some(appt => {
        if (editingId && appt.id === editingId) return false;
        if (appt.date !== currentDate || appt.staff !== currentStaff) return false;
        
        const rawStart = appt.start_time || appt.startTime;
        const rawEnd = appt.end_time || appt.endTime;
        
        const existStart = parseFloat(rawStart.split(':')[0]) + parseFloat(rawStart.split(':')[1]) / 60;
        const existEnd = parseFloat(rawEnd.split(':')[0]) + parseFloat(rawEnd.split(':')[1]) / 60;
        return newStart < existEnd && newEnd > existStart;
    });
}

// State-Driven Form UI Management
function updateFormUI() {
    if (startTimeInput.value) {
        durationPreview.innerHTML = `<strong>Duration Span:</strong> ${startTimeInput.value} to ${calculateEndTime(startTimeInput.value, serviceSelect.value)}`;
    }
    
    // Check if the technician currently selected in the form is blocked off
    const isTargetStaffBlocked = appointments.some(a => 
        a.date === dateInput.value && 
        a.staff === staffSelect.value && 
        a.customer === 'STAFF_BLOCKED'
    );
    
    if (isTargetStaffBlocked) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = `⚠️ <strong>Technician Unavailable:</strong> ${staffSelect.value} is blocked off for a Day Off today.`;
        submitBtn.textContent = 'Technician Unavailable';
        submitBtn.className = 'btn-submit btn-warning-state';
        submitBtn.disabled = true;
        return;
    }
    
    submitBtn.disabled = false;
    const hasConflict = checkConflict();
    if (hasConflict) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = `⚠️ <strong>Schedule Conflict:</strong> ${staffSelect.value} is already booked here.`;
        submitBtn.textContent = forceConfirmActive ? '⚠️ Confirm Double Book Anyway' : 'Check Conflict Options';
        submitBtn.className = 'btn-submit ' + (forceConfirmActive ? 'btn-warning-state' : 'btn-normal');
    } else {
        warningBanner.style.display = 'none';
        submitBtn.textContent = editingId ? 'Update Appointment Changes' : 'Save to Cloud Grid';
        submitBtn.className = 'btn-submit btn-normal';
        forceConfirmActive = false;
    }
}

function startEditing(appt) {
    if (appt.customer === 'STAFF_BLOCKED') return; // Do not edit blocker tiles
    
    editingId = appt.id;
    dateInput.value = appt.date;
    customerInput.value = appt.customer;
    staffSelect.value = appt.staff;
    serviceSelect.value = appt.service;
    startTimeInput.value = appt.start_time || appt.startTime;
    if (notesInput) notesInput.value = appt.notes || '';

    deleteBtn.style.display = 'block';
    cancelEditBtn.style.display = 'block';
    updateFormUI();
}

function resetForm() {
    editingId = null;
    customerInput.value = '';
    if (notesInput) notesInput.value = '';
    deleteBtn.style.display = 'none';
    cancelEditBtn.style.display = 'none';
    forceConfirmActive = false;
    updateFormUI();
}

function renderCalendarGrid() {
    staffTrackContainer.innerHTML = '';
    
    // Refresh header indicators live alongside grid redraws
    updateCalendarHeaderUI();
    
    STAFF_MEMBERS.forEach(staffName => {
        const columnTrack = document.createElement('div');
        columnTrack.className = 'staff-column';
        
        const staffDayEvents = appointments.filter(a => a.date === dateInput.value && a.staff === staffName);
        const isBlockedOff = staffDayEvents.some(a => a.customer === 'STAFF_BLOCKED');
        
        if (isBlockedOff) {
            const overlay = document.createElement('div');
            overlay.className = 'blocked-day-overlay';
            overlay.innerHTML = '<div class="blocked-badge">Day Off</div>';
            columnTrack.appendChild(overlay);
        } else {
            // 🌟 NEW FUNCTIONALITY: Empty Track Click Handler to Auto-Fill Form
            columnTrack.addEventListener('click', function(e) {
                // Ensure clicks directly on child element appointment-blocks don't trigger a new fill action
                if (e.target !== columnTrack) return;
                
                // Clear any leftover edit state variables safely
                resetForm();
                
                // Calculate position relative to timeline track ($60px height per hour = 1px per minute)
                const clickY = e.offsetY;
                const totalMinutesClicked = clickY;
                
                // Round downwards to the nearest standard 15-minute operational interval block
                const roundedMinutes = Math.floor(totalMinutesClicked / 15) * 15;
                
                const clickHour = START_HOUR + Math.floor(roundedMinutes / 60);
                const clickMinute = roundedMinutes % 60;
                
                const formattedTime = `${clickHour.toString().padStart(2, '0')}:${clickMinute.toString().padStart(2, '0')}`;
                
                // Autofill left workspace controllers instantly
                staffSelect.value = staffName;
                startTimeInput.value = formattedTime;
                
                // Auto-focus name field to prompt immediate customer input action
                customerInput.focus();
                
                updateFormUI();
            });

            staffDayEvents.forEach(appt => {
                const rawStart = appt.start_time || appt.startTime;
                const rawEnd = appt.end_time || appt.endTime;

                const [stH, stM] = rawStart.split(':').map(Number);
                const [endH, endM] = rawEnd.split(':').map(Number);
                
                const block = document.createElement('div');
                block.className = 'appointment-block';
                block.style.top = `${(stH - START_HOUR) * 60 + stM}px`;
                block.style.height = `${(endH - stH) * 60 + (endM - stM)}px`;
                block.style.cursor = 'pointer';
                
                block.innerHTML = `
                    <div style="font-weight: 700; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${appt.customer}</div>
                    <div style="opacity: 0.95; font-size: 0.88em; font-weight: 500;">${appt.service}</div>
                    <div style="font-size: 0.78em; margin-top: 2px; font-weight: bold; opacity: 0.8;">${rawStart} - ${rawEnd}</div>
                    ${appt.notes ? `<div class="appointment-notes" title="${appt.notes}">📝 ${appt.notes}</div>` : ''}
                `;
                
                block.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stops the container timeline click handler from firing
                    startEditing(appt);
                });
                columnTrack.appendChild(block);
            });
        }
        staffTrackContainer.appendChild(columnTrack);
    });
}

// Fetch calendar data from database (Only works if session is authorized)
async function fetchData() {
    const { data, error } = await supabaseClient.from('appointments').select('*');
    if (!error) {
        appointments = data;
        renderCalendarGrid();
        updateFormUI();
    }
}

// Show schedule dashboard interface layer
function showDashboard() {
    loginOverlay.style.display = 'none';
    appWorkspace.style.opacity = '1';
    appWorkspace.style.pointerEvents = 'auto';
    initFormElements();
    fetchData();
}

// Show login layer interface template block
function showLogin() {
    loginOverlay.style.display = 'flex';
    appWorkspace.style.opacity = '0';
    appWorkspace.style.pointerEvents = 'none';
}

// Connect application to backend database layer
async function initSupabase() {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Check if user is already remembered locally from a past session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showDashboard();
    } else {
        showLogin();
    }
}

// LOGIN SUBMISSION HANDLER
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    loginBtn.textContent = 'Verifying...';
    loginError.style.display = 'none';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail.value,
        password: loginPassword.value
    });

    if (error) {
        loginError.textContent = `❌ ${error.message}`;
        loginError.style.display = 'block';
        loginBtn.textContent = 'Sign In';
    } else {
        loginBtn.textContent = 'Sign In';
        showDashboard();
    }
});

// LOGOUT HANDLER LINK
logoutBtn.addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    appointments = [];
    loginEmail.value = '';
    loginPassword.value = '';
    showLogin();
});

// Form Submit Pipeline (Handles both New Bookings and Updates)
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (checkConflict() && !forceConfirmActive) {
        forceConfirmActive = true;
        updateFormUI();
        return;
    }

    const payload = {
        date: dateInput.value,
        customer: customerInput.value,
        staff: staffSelect.value,
        service: serviceSelect.value,
        start_time: startTimeInput.value,
        end_time: calculateEndTime(startTimeInput.value, serviceSelect.value),
        notes: notesInput.value
    };

    submitBtn.textContent = 'Saving...';

    if (editingId) {
        const { data, error } = await supabaseClient.from('appointments').update(payload).eq('id', editingId).select();
        if (!error) {
            const idx = appointments.findIndex(a => a.id === editingId);
            appointments[idx] = data[0];
            resetForm();
            renderCalendarGrid();
        }
    } else {
        const { data, error } = await supabaseClient.from('appointments').insert([payload]).select();
        if (!error) {
            appointments.push(data[0]);
            resetForm();
            renderCalendarGrid();
        }
    }
});

// Delete Execution Link Interceptions
deleteBtn.addEventListener('click', async function() {
    if (!editingId) return;
    if (confirm(`Delete appointment for ${customerInput.value}?`)) {
        const { error } = await supabaseClient.from('appointments').delete().eq('id', editingId);
        if (!error) {
            appointments = appointments.filter(a => a.id !== editingId);
            resetForm();
            renderCalendarGrid();
        }
    }
});

cancelEditBtn.addEventListener('click', resetForm);

[dateInput, staffSelect, serviceSelect, startTimeInput, customDurationInput].forEach(el => el.addEventListener('change', () => { 
    forceConfirmActive = false; 
    if (serviceSelect.value === 'Other (Custom)') {
        customDurationGroup.style.display = 'block';
    } else {
        customDurationGroup.style.display = 'none';
    }
    
    renderCalendarGrid(); 
    updateFormUI(); 
}));

customDurationInput.addEventListener('input', updateFormUI);

window.addEventListener('load', () => { 
    initSupabase();
    const now = new Date();
    if (now.getHours() >= START_HOUR && now.getHours() < 22) {
        calendarScrollWindow.scrollTop = (now.getHours() - START_HOUR) * 60 + now.getMinutes() - 40;
    }
});
