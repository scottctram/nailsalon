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
let editingId = null; // Track if we are currently editing an appointment

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
        // Skip comparing against ITSELF if we are modifying an existing appointment
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

// Triggered when a staff member clicks a calendar block
function startEditing(appt) {
    editingId = appt.id;
    
    // Fill form inputs with selected appointment data
    dateInput.value = appt.date;
    customerInput.value = appt.customer;
    staffSelect.value = appt.staff;
    serviceSelect.value = appt.service;
    startTimeInput.value = appt.start_time || appt.startTime;
    if (notesInput) notesInput.value = appt.notes || '';

    // Show Delete and Cancel buttons, hide standard default text
    deleteBtn.style.display = 'block';
    cancelEditBtn.style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll back to form layout view
    updateFormUI();
}

// Clear the form and reset button states back to default
function resetForm() {
    editingId = null;
    customerInput.value = '';
    if (notesInput) notesInput.value = '';
    deleteBtn.style.display = 'none';
    cancelEditBtn.style.display = 'none';
    forceConfirmActive = false;
    updateFormUI();
}

// Canvas Painting: Clears and redraws floating timeline appointment nodes
function renderCalendarGrid() {
    staffTrackContainer.innerHTML = '';
    STAFF_MEMBERS.forEach(staffName => {
        const columnTrack = document.createElement('div');
        columnTrack.className = 'staff-column';
        
        appointments.filter(a => a.date === dateInput.value && a.staff === staffName).forEach(appt => {
            const rawStart = appt.start_time || appt.startTime;
            const rawEnd = appt.end_time || appt.endTime;

            const [stH, stM] = rawStart.split(':').map(Number);
            const [endH, endM] = rawEnd.split(':').map(Number);
            
            const block = document.createElement('div');
            block.className = 'appointment-block';
            block.style.top = `${(stH - START_HOUR) * 60 + stM}px`;
            block.style.height = `${(endH - stH) * 60 + (endM - stM)}px`;
            block.style.cursor = 'pointer'; // Visual cue that block can be clicked
            
            block.innerHTML = `
                <div style="font-weight: 700; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${appt.customer}</div>
                <div style="opacity: 0.95; font-size: 0.88em; font-weight: 500;">${appt.service}</div>
                <div style="font-size: 0.78em; margin-top: 2px; font-weight: bold; opacity: 0.8;">${rawStart} - ${rawEnd}</div>
                ${appt.notes ? `<div class="appointment-notes" title="${appt.notes}">📝 ${appt.notes}</div>` : ''}
            `;
            
            // Click Handler to load data into sidebar form
            block.addEventListener('click', () => startEditing(appt));
            
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

    submitBtn.textContent = 'Saving to Cloud...';

    if (editingId) {
        // UPDATE EXISTING APPOINTMENT IN SUPABASE
        const { data, error } = await supabaseClient.from('appointments').update(payload).eq('id', editingId).select();
        
        if (error) {
            alert('Database Update Error: ' + error.message);
        } else {
            // Locate local instance and refresh values
            const idx = appointments.findIndex(a => a.id === editingId);
            appointments[idx] = data[0];
            resetForm();
            renderCalendarGrid();
        }
    } else {
        // CREATE NEW APPOINTMENT IN SUPABASE
        const { data, error } = await supabaseClient.from('appointments').insert([payload]).select();

        if (error) {
            alert('Database Write Error: ' + error.message);
            updateFormUI();
        } else {
            appointments.push(data[0]);
            resetForm();
            renderCalendarGrid();
        }
    }
});

// DELETE BUTTON ACTION PIPELINE
deleteBtn.addEventListener('click', async function() {
    if (!editingId) return;
    
    if (confirm(`Are you sure you want to permanently delete the appointment for ${customerInput.value}?`)) {
        submitBtn.textContent = 'Deleting...';
        
        const { error } = await supabaseClient.from('appointments').delete().eq('id', editingId);
        
        if (error) {
            alert('Database Deletion Error: ' + error.message);
            updateFormUI();
        } else {
            // Wipe out local reference and repaint grid canvas
            appointments = appointments.filter(a => a.id !== editingId);
            resetForm();
            renderCalendarGrid();
        }
    }
});

// CANCEL EDIT PIPELINE LINKS
cancelEditBtn.addEventListener('click', resetForm);

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
