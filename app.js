// ==========================================
// ⚠️ PASTE YOUR SECURE CLOUD KEYS RIGHT HERE
// ==========================================
const SUPABASE_URL = 'https://rdfxkunntwffxibaoqnk.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_lYXIa2nPYnpn6CGpPHNVEw_yDOp0P13';

// Core Application Configurations
const SERVICES = { 
    'Gel Manicure': 45, 
    'Pedicure': 60, 
    'Acrylic Full Set': 90, 
    'Nail Art Removal': 15 
};
const STAFF_MEMBERS = ['Alice', 'Bella', 'Chloe', 'Diana'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const START_HOUR = 9;

// State Memory Cache
let appointments = [];
let forceConfirmActive = false;
let supabaseClient = null;

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
const calendarHeader = document.getElementById('calendarHeader');
const timeColumn = document.getElementById('timeColumn');
const staffTrackContainer = document.getElementById('staffTrackContainer');
const calendarScrollWindow = document.getElementById('calendarScrollWindow');

// Initialize Dynamic HTML Dropdowns & Matrix Columns
function initFormElements() {
    dateInput.value = new Date().toISOString().split('T')[0];
    
    STAFF_MEMBERS.forEach(s => { 
        staffSelect.appendChild(new Option(s, s)); 
        calendarHeader.appendChild(Object.assign(document.createElement('div'), {className: 'header-cell', textContent: s})); 
    });
    
    Object.keys(SERVICES).forEach(s => serviceSelect.appendChild(new Option(`${s} (${SERVICES[s]} min)`, s)));
    HOURS.forEach(h => timeColumn.appendChild(Object.assign(document.createElement('div'), {className: 'time-slot', textContent: h})));
}

// Calculate Accurate Service End Boundary Windows
function calculateEndTime(start, serviceName) {
    const duration = SERVICES[serviceName];
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
        if (appt.date !== currentDate || appt.staff !== currentStaff) return false;
        const existStart = parseFloat(appt.startTime.split(':')[0]) + parseFloat(appt.startTime.split(':')[1]) / 60;
        const existEnd = parseFloat(appt.endTime.split(':')[0]) + parseFloat(appt.endTime.split(':')[1]) / 60;
        return newStart < existEnd && newEnd > existStart;
    });
}

// State-Driven Form UI Management
function updateFormUI() {
    if (startTimeInput.value) {
        durationPreview.innerHTML = `<strong>Duration Span:</strong> ${startTimeInput.value} to ${calculateEndTime(startTimeInput.value, serviceSelect.value)}`;
    }
    const hasConflict = checkConflict();
    if (hasConflict) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = `⚠️ <strong>Schedule Conflict:</strong> ${staffSelect.value} is already booked here.`;
        submitBtn.textContent = forceConfirmActive ? '⚠️ Confirm Double Book Anyway' : 'Check Conflict Options';
        submitBtn.className = 'btn-submit ' + (forceConfirmActive ? 'btn-warning-state' : 'btn-normal');
    } else {
        warningBanner.style.display = 'none';
        submitBtn.textContent = 'Save to Cloud Grid';
        submitBtn.className = 'btn-submit btn-normal';
        forceConfirmActive = false;
    }
}

// Canvas Painting: Clears and redraws floating timeline appointment nodes
function renderCalendarGrid() {
    staffTrackContainer.innerHTML = '';
    STAFF_MEMBERS.forEach(staffName => {
        const columnTrack = document.createElement('div');
        columnTrack.className = 'staff-column';
        appointments.filter(a => a.date === dateInput.value && a.staff === staffName).forEach(appt => {
            const [stH, stM] = appt.startTime.split(':').map(Number);
            const [endH, endM] = appt.endTime.split(':').map(Number);
            const block = document.createElement('div');
            block.className = 'appointment-block';
            block.style.top = `${(stH - START_HOUR) * 60 + stM}px`;
            block.style.height = `${(endH - stH) * 60 + (endM - stM)}px`;
            block.innerHTML = `<strong>${appt.customer}</strong><br>${appt.service}<br>${appt.startTime}-${appt.endTime}`;
            columnTrack.appendChild(block);
        });
        staffTrackContainer.appendChild(columnTrack);
    });
}

// Connect application to backend data storage layer
async function initSupabase() {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data, error } = await supabaseClient.from('appointments').select('*');
        if (error) throw error;
        appointments = data;
        renderCalendarGrid();
        updateFormUI();
    } catch (err) {
        submitBtn.textContent = 'Database Connection Failed';
        console.error(err);
    }
}

// Form Intercept Pipelines
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (checkConflict() && !forceConfirmActive) {
        forceConfirmActive = true;
        updateFormUI();
        return;
    }

    const newBooking = {
        date: dateInput.value,
        customer: customerInput.value,
        staff: staffSelect.value,
        service: serviceSelect.value,
        startTime: startTimeInput.value,
        endTime: calculateEndTime(startTimeInput.value, serviceSelect.value)
    };

    submitBtn.textContent = 'Saving...';
    const { data, error } = await supabaseClient.from('appointments').insert([newBooking]).select();

    if (error) {
        alert('Database Write Error: ' + error.message);
    } else {
        appointments.push(data[0]);
        customerInput.value = '';
        forceConfirmActive = false;
        renderCalendarGrid();
        updateFormUI();
    }
});

// Dynamic Change Observers
[dateInput, staffSelect, serviceSelect, startTimeInput].forEach(el => el.addEventListener('change', () => { 
    forceConfirmActive = false; 
    renderCalendarGrid(); 
    updateFormUI(); 
}));

// App Lifespan Hook Triggers
window.addEventListener('load', () => { 
    initFormElements(); 
    initSupabase();
    const now = new Date();
    if (now.getHours() >= START_HOUR && now.getHours() < 18) {
        calendarScrollWindow.scrollTop = (now.getHours() - START_HOUR) * 60 + now.getMinutes() - 40;
    }
});
