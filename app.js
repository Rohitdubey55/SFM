// ============================================
// K D Memorial - GitHub App (GAS API Backend)
// ============================================

// CONFIG: Your Google Apps Script Web App URL
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxnaSTYPb8mvpo-OGN01fM_at35RRfzquYq2d7D3ANcYZ4CQeIdLjgGC9KiQ3n6zfflaw/exec";

// Column mapping - match your exact Google Sheet headers
const COLS = {
  ROLL: "Roll No.",
  CLASS: "Class",
  NAME: "Student Name",
  FATHER: "Father Name",
  PHONE: "Mobile",
  EMAIL: "Email",
  ADDRESS: "Address",
  DOB: "Date of Birth",
  ADMISSION: "Admission Date",
  PREV_BAL: "Balance Upto Dec 2025",
  TUITION: "Fee Dec-March",
  VAN: "Van Fee Upto March",
  OTHER: "Ot (Exam-200,R-Card-200)",
  TOTAL: "Total",
  REC: "Rec.",
  BAL: "Balance",
  ROUTE: "Route No.",
  PICKUP: "Pickup Point",
  LAST_PAY: "Last Payment Date",
  REMINDER: "Last Reminder",
  RECEIPT: "Receipt No."
};

// Also check old column names for backward compatibility
const COLS_OLD = {
  VAN: "Van\nFee Upto\nMarch",
  TUITION: "Fee\nDec. to\nMarch",
  OTHER: "Ot\nExam-200\nR-Card-200",
  PREV_BAL: "Balance\nUpto\nDec 2025"
};

// Sheet names
const SHEETS = {
  STUDENTS: "Sheet1",
  TRANSACTIONS: "Transactions",
  EXPENSES: "Expenses",
  STAFF: "Staff"
};

// Global state
let students = [];
let transactions = [];
let currentSort = { field: null, asc: true };
let CURRENT_STUDENT = null;
let DAY_IN = 0;
let DAY_OUT = 0;
let receiptCounter = 0;

// ============================================
// API Functions (Google Apps Script)
// ============================================

// Generic GET request to GAS API
async function gasGet(sheetName) {
  const url = `${GAS_API_URL}?action=get&sheet=${encodeURIComponent(sheetName)}`;
  try {
    const response = await fetch(url, { redirect: "follow" });
    const text = await response.text();
    const data = JSON.parse(text);
    if (data.success) {
      return data.data;
    }
    console.error("GAS Error:", data.error || data.message);
    return [];
  } catch (err) {
    console.error("Network Error:", err);
    return [];
  }
}

// Generic POST request to GAS API
async function gasPost(action, sheetName, payload = {}, id = null) {
  const body = { action, sheet: sheetName, payload };
  if (id) body.id = id;
  
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      redirect: "follow"
    });
    const text = await response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Network Error:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// Initialization
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  showProgress(30);
  await refreshData();
  showProgress(100);
  setTimeout(() => {
    document.getElementById("appLoader").style.opacity = "0";
    setTimeout(() => {
      document.getElementById("appLoader").style.display = "none";
    }, 500);
  }, 800);
});

function showProgress(percent) {
  document.getElementById("progressBar").style.width = percent + "%";
}

async function refreshData() {
  showProgress(50);
  students = await gasGet(SHEETS.STUDENTS);
  transactions = await gasGet(SHEETS.TRANSACTIONS);
  
  // Generate unique IDs for each student if not present
  students = students.map((s, index) => {
    if (!s.id) {
      s.id = String(index + 1); // Use 1-based index as ID
    }
    return s;
  });
  
  showProgress(80);
  
  // Get last receipt number
  if (transactions.length > 0) {
    const receipts = transactions.map(t => Number(t["Receipt No."] || t["Receipt No"] || 0)).filter(r => r > 0);
    receiptCounter = receipts.length > 0 ? Math.max(...receipts) : 0;
  }
  
  renderDashboard();
  renderTable();
  renderVanTable();
  renderClassChips();
}

// ============================================
// Mobile Navigation
// ============================================

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('active');
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('active');
}

// ============================================
// Mobile Navigation
// ============================================

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
  }
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  }
}

// ============================================
// Navigation
// ============================================

function switchView(viewName, btn) {
  // Update nav
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  
  // Update view
  document.querySelectorAll(".view-section").forEach(v => v.classList.remove("active"));
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.add("active");
  
  // Close mobile menu
  closeMobileMenu();
  
  // Update title
  const titles = {
    dashboard: "Dashboard",
    database: "All Students",
    van: "Van Students",
    daybook: "Day Book",
    expenses: "Expenses",
    staff: "Staff Payroll",
    reports: "Print/Reports"
  };
  document.getElementById("pageTitle").innerText = titles[viewName] || viewName;
  
  // Load reports data if needed
  if (viewName === 'reports') {
    loadReports();
  }
}

// ============================================
// Dashboard
// ============================================

// Get value using column mapping - with backward compatibility
function getVal(obj, colKey) {
  // Try direct key first
  let val = obj[colKey];
  
  // Try new column name
  if (!val && COLS[colKey]) {
    val = obj[COLS[colKey]];
  }
  
  // Try old column name (with newlines)
  if (!val && COLS_OLD[colKey]) {
    val = obj[COLS_OLD[colKey]];
  }
  
  return val || "";
}

// Helper to safely get numeric values - with backward compatibility
function getNum(obj, colKey) {
  // Try new column name first
  let val = obj[colKey] || obj[COLS[colKey]] || "";
  
  // If empty, try old column name
  if (!val && COLS_OLD[colKey]) {
    val = obj[COLS_OLD[colKey]] || "";
  }
  
  return Number(val) || 0;
}

function renderDashboard() {
  const totalStudents = students.length;
  let totalCollected = 0;
  let totalPending = 0;
  let vanStudents = 0;
  let vanRevenue = 0;
  
  students.forEach(s => {
    const received = getNum(s, "REC");
    const total = getNum(s, "TOTAL");
    const balance = getNum(s, "BAL");
    const vanFee = getNum(s, "VAN");
    totalCollected += received;
    totalPending += balance;
    if (vanFee > 0) {
      vanStudents++;
      vanRevenue += vanFee;
    }
  });
  
  document.getElementById("kpiCount").innerText = totalStudents;
  document.getElementById("kpiCollected").innerText = "₹" + totalCollected.toLocaleString();
  document.getElementById("kpiPending").innerText = "₹" + totalPending.toLocaleString();
  
  // Update dashboard cards if they exist
  const kpiVanEl = document.getElementById('kpiVan');
  const kpiVanRevEl = document.getElementById('kpiVanRevenue');
  if (kpiVanEl) kpiVanEl.innerText = vanStudents;
  if (kpiVanRevEl) kpiVanRevEl.innerText = '₹' + vanRevenue.toLocaleString();
}

// ============================================
// Student Table
// ============================================

function renderClassChips() {
  const classes = [...new Set(students.map(s => getVal(s, "CLASS")).filter(Boolean))].sort();
  const container = document.getElementById("classChips");
  
  let html = `<div class="chip active" onclick="filterByClass('all', this)">All</div>`;
  classes.forEach(cls => {
    html += `<div class="chip" onclick="filterByClass('${cls}', this)">${cls}</div>`;
  });
  
  // Add filter chips for balance status
  html += `<div class="chip chip-danger" onclick="filterByBalance('pending', this)" title="Show only pending">Due</div>`;
  html += `<div class="chip chip-success" onclick="filterByBalance('paid', this)" title="Show only paid">Paid</div>`;
  
  container.innerHTML = html;
}

let currentBalanceFilter = null;

function filterByBalance(status, chip) {
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  currentBalanceFilter = status;
  renderTable();
}

function filterByBalanceStatus(s) {
  if (!currentBalanceFilter || currentBalanceFilter === 'all') return true;
  const balance = getNum(s, "BAL");
  if (currentBalanceFilter === 'pending') return balance > 0;
  if (currentBalanceFilter === 'paid') return balance <= 0;
  return true;
}

function filterByClass(cls, chip) {
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  renderTable(cls);
}

function renderTable(filterClass = null) {
  let data = students;
  
  // Apply class filter
  if (filterClass && filterClass !== "all") {
    data = data.filter(s => getVal(s, "CLASS") === filterClass);
  }
  
  // Apply balance filter
  data = data.filter(filterByBalanceStatus);
  
  // Apply sort
  if (currentSort.field) {
    data = [...data].sort((a, b) => {
      let va = getVal(a, currentSort.field.toUpperCase());
      let vb = getVal(b, currentSort.field.toUpperCase());
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return currentSort.asc ? -1 : 1;
      if (va > vb) return currentSort.asc ? 1 : -1;
      return 0;
    });
  }
  
  // Apply search
  const search = document.getElementById("searchInput").value.toLowerCase();
  if (search) {
    data = data.filter(s => 
      (getVal(s, "NAME") && getVal(s, "NAME").toLowerCase().includes(search)) ||
      (getVal(s, "ROLL") && String(getVal(s, "ROLL")).includes(search)) ||
      (getVal(s, "CLASS") && getVal(s, "CLASS").toLowerCase().includes(search)) ||
      (getVal(s, "PHONE") && String(getVal(s, "PHONE")).includes(search))
    );
  }
  
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = data.map(s => {
    const total = getNum(s, "TOTAL");
    const balance = getNum(s, "BAL");
    const phone = getVal(s, "PHONE");
    const hasPhone = phone && phone.length >= 10;
    return `
      <tr>
        <td>${getVal(s, "ROLL")}</td>
        <td><strong>${getVal(s, "NAME")}</strong></td>
        <td>${getVal(s, "CLASS")}</td>
        <td>₹${total.toLocaleString()}</td>
        <td style="color: ${balance > 0 ? '#ef4444' : '#10b981'}">₹${balance.toLocaleString()}</td>
        <td class="action-btns">
          ${hasPhone ? `<button class="btn-icon btn-wa-sm" onclick="sendWA(${s.id})" title="WhatsApp"><svg viewBox="0 0 24 24" width="16" height="16" fill="#25d366"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.029.66 2.028.938 3.267.938 3.188 0 5.768-2.587 5.768-5.771.001-3.185-2.58-5.767-5.769-5.767zm0 10.198c-1.125 0-2.062-.271-2.923-.746l-1.399.367.373-1.359c-.538-.857-.822-1.637-.821-2.693.001-2.441 1.987-4.428 4.428-4.428 2.443 0 4.43 1.986 4.43 4.427 0 2.442-1.985 4.43 4.432z"/></svg></button>` : ''}
          <button class="btn-icon" onclick="openProfile(${s.id})" title="View"><span class="material-icons-round" style="font-size:18px">visibility</span></button>
          <button class="btn-icon" onclick="openModal(${s.id})" title="Edit"><span class="material-icons-round" style="font-size:18px">edit</span></button>
        </td>
      </tr>
    `;
  }).join("");
}

// Search
document.getElementById("searchInput").addEventListener("input", () => renderTable());

// Sort
function sortData(field) {
  if (currentSort.field === field) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.field = field;
    currentSort.asc = true;
  }
  
  document.querySelectorAll(".data-table th").forEach(th => th.classList.remove("sorted"));
  document.getElementById(`sort-${field}`).parentElement.classList.add("sorted");
  renderTable();
}

// ============================================
// Van Table
// ============================================

function renderVanTable() {
  const vanStudents = students.filter(s => getNum(s, "VAN") > 0);
  const tbody = document.getElementById("vanTableBody");
  
  document.getElementById("vanCount").innerText = vanStudents.length;
  const revenue = vanStudents.reduce((sum, s) => sum + getNum(s, "VAN"), 0);
  document.getElementById("vanRevenue").innerText = "₹" + revenue.toLocaleString();
  
  tbody.innerHTML = vanStudents.map(s => {
    const balance = getNum(s, "BAL");
    return `
      <tr>
        <td>${getVal(s, "ROLL")}</td>
        <td><strong>${getVal(s, "NAME")}</strong></td>
        <td>${getVal(s, "CLASS")}</td>
        <td>₹${getNum(s, "VAN").toLocaleString()}</td>
        <td style="color: ${balance > 0 ? '#ef4444' : '#10b981'}">₹${balance.toLocaleString()}</td>
        <td>
          <button class="btn-icon" onclick="openProfile(${s.id})" title="View"><span class="material-icons-round" style="font-size:18px">visibility</span></button>
        </td>
      </tr>
    `;
  }).join("");
}

// ============================================
// Modal Functions
// ============================================

function openModal(id) {
  document.getElementById("studentId").value = id;
  document.getElementById("modalTitle").innerText = id === "NEW" ? "Add New Student" : "Edit Student";
  
  if (id === "NEW") {
    document.getElementById("studentForm").reset();
    document.getElementById("inpRoll").value = "";
    document.getElementById("inpRec").value = 0;
  } else {
    const s = students.find(st => st.id == id);
    if (s) {
      document.getElementById("inpRoll").value = getVal(s, "ROLL");
      document.getElementById("inpClass").value = getVal(s, "CLASS");
      document.getElementById("inpName").value = getVal(s, "NAME");
      document.getElementById("inpFather").value = getVal(s, "FATHER");
      document.getElementById("inpPhone").value = getVal(s, "PHONE");
      document.getElementById("inpEmail").value = getVal(s, "EMAIL") || "";
      document.getElementById("inpAddress").value = getVal(s, "ADDRESS") || "";
      document.getElementById("inpDOB").value = getVal(s, "DOB") || "";
      document.getElementById("inpRoute").value = getVal(s, "ROUTE") || "";
      document.getElementById("inpPickup").value = getVal(s, "PICKUP") || "";
      document.getElementById("inpTuition").value = getNum(s, "TUITION");
      document.getElementById("inpVan").value = getNum(s, "VAN");
      document.getElementById("inpOther").value = getNum(s, "OTHER");
      document.getElementById("inpPrev").value = getNum(s, "PREV_BAL");
      document.getElementById("inpRec").value = getNum(s, "REC");
    }
  }
  
  document.getElementById("modalOverlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById("studentId").value;
  const payload = {};
  
  // Map form fields to actual column names
  payload[COLS.ROLL] = document.getElementById("inpRoll").value;
  payload[COLS.CLASS] = document.getElementById("inpClass").value;
  payload[COLS.NAME] = document.getElementById("inpName").value;
  payload[COLS.FATHER] = document.getElementById("inpFather").value;
  payload[COLS.PHONE] = document.getElementById("inpPhone").value;
  payload[COLS.EMAIL] = document.getElementById("inpEmail").value;
  payload[COLS.ADDRESS] = document.getElementById("inpAddress").value;
  payload[COLS.DOB] = document.getElementById("inpDOB").value;
  payload[COLS.ROUTE] = document.getElementById("inpRoute").value;
  payload[COLS.PICKUP] = document.getElementById("inpPickup").value;
  payload[COLS.TUITION] = Number(document.getElementById("inpTuition").value) || 0;
  payload[COLS.VAN] = Number(document.getElementById("inpVan").value) || 0;
  payload[COLS.OTHER] = Number(document.getElementById("inpOther").value) || 0;
  payload[COLS.PREV_BAL] = Number(document.getElementById("inpPrev").value) || 0;
  payload[COLS.REC] = Number(document.getElementById("inpRec").value) || 0;
  
  // Calculate total and balance
  payload[COLS.TOTAL] = payload[COLS.PREV_BAL] + payload[COLS.TUITION] + payload[COLS.VAN] + payload[COLS.OTHER];
  payload[COLS.BAL] = payload[COLS.TOTAL] - payload[COLS.REC];
  
  // Get existing receipt number if editing
  if (id !== "NEW") {
    const existing = students.find(st => st.id == id);
    if (existing) {
      payload[COLS.RECEIPT] = getVal(existing, "RECEIPT") || "";
    }
  }
  
  const btn = document.getElementById("btnSave");
  btn.innerText = "Saving...";
  btn.disabled = true;
  
  const action = id === "NEW" ? "create" : "update";
  const result = await gasPost(action, SHEETS.STUDENTS, payload, id !== "NEW" ? id : null);
  
  if (result.success) {
    alert("Saved successfully!");
    closeModal();
    await refreshData();
  } else {
    alert("Error: " + (result.error || result.message));
  }
  
  btn.innerText = "Save Record";
  btn.disabled = false;
}

async function deleteRecord() {
  const id = document.getElementById("studentId").value;
  if (id === "NEW") return;
  
  if (confirm("Are you sure you want to delete this student?")) {
    const result = await gasPost("delete", SHEETS.STUDENTS, {}, id);
    if (result.success) {
      alert("Deleted successfully!");
      closeModal();
      await refreshData();
    } else {
      alert("Error: " + (result.error || result.message));
    }
  }
}

// ============================================
// Profile Functions
// ============================================

function openProfile(id) {
  const s = students.find(st => st.id == id);
  if (!s) return;
  
  CURRENT_STUDENT = s;
  
  document.getElementById("avatarLetter").innerText = getVal(s, "NAME").charAt(0).toUpperCase();
  document.getElementById("pName").innerText = getVal(s, "NAME");
  document.getElementById("pClass").innerText = getVal(s, "CLASS");
  document.getElementById("pRoll").innerText = getVal(s, "ROLL");
  document.getElementById("pFather").innerText = getVal(s, "FATHER") || "-";
  document.getElementById("pPhone").innerText = getVal(s, "PHONE") || "-";
  document.getElementById("pLastRem").innerText = getVal(s, "REMINDER") ? new Date(getVal(s, "REMINDER")).toLocaleDateString() : "Never";
  
  const total = getNum(s, "TOTAL");
  const received = getNum(s, "REC");
  const balance = getNum(s, "BAL");
  
  document.getElementById("pTotal").innerText = "₹" + total.toLocaleString();
  document.getElementById("pPaid").innerText = "₹" + received.toLocaleString();
  document.getElementById("pBal").innerText = "₹" + balance.toLocaleString();
  
  document.getElementById("profileOverlay").style.display = "flex";
}

function closeProfile() {
  document.getElementById("profileOverlay").style.display = "none";
  CURRENT_STUDENT = null;
}

function openFeeModal() {
  if (!CURRENT_STUDENT) return;
  
  // Close profile first
  closeProfile();
  
  document.getElementById("fee_name").innerText = getVal(CURRENT_STUDENT, "NAME");
  document.getElementById("fee_class").innerText = getVal(CURRENT_STUDENT, "CLASS");
  document.getElementById("fee_bal").innerText = "₹" + getNum(CURRENT_STUDENT, "BAL");
  document.getElementById("fee_amount").value = "";
  document.getElementById("feeModalOverlay").style.display = "flex";
}

async function submitFee() {
  const amount = document.getElementById("fee_amount").value;
  if (!amount || amount <= 0) return alert("Enter valid amount");
  
  const btn = event.target;
  btn.innerText = "Processing...";
  btn.disabled = true;
  
  const s = CURRENT_STUDENT;
  const txn = {
    Roll: getVal(s, "ROLL"),
    Name: getVal(s, "NAME"),
    Class: getVal(s, "CLASS"),
    Amount: amount,
    Mode: document.getElementById("fee_mode").value,
    Remarks: document.getElementById("fee_remarks").value
  };
  
  // Save to transactions sheet
  const result = await gasPost("create", SHEETS.TRANSACTIONS, txn);
  
  if (result.success) {
    // Update student record - add to received
    const newRec = getNum(s, "REC") + Number(amount);
    const newBal = getNum(s, "TOTAL") - newRec;
    
    await gasPost("update", SHEETS.STUDENTS, { Rec: newRec, Bal: newBal }, s.id);
    
    alert("Fee Collected Successfully!");
    document.getElementById("feeModalOverlay").style.display = "none";
    closeProfile();
    await refreshData();
  } else {
    alert("Error: " + (result.error || result.message));
  }
  
  btn.innerText = "Confirm Payment";
  btn.disabled = false;
}

// ============================================
// WhatsApp - Individual & Bulk
// ============================================

function sendWA(id = null) {
  let s;
  if (id) {
    s = students.find(st => st.id == id);
  } else {
    s = CURRENT_STUDENT;
  }
  
  if (!s) return alert("Error: No student selected.");
  
  let phone = String(getVal(s, "PHONE")).replace(/\D/g, "");
  
  if (phone.length < 10) {
    alert("Invalid Phone Number: '" + getVal(s, "PHONE") + "'\nPlease update it in the Edit menu.");
    return;
  }
  
  if (phone.length === 10) phone = "91" + phone;
  
  const msg = `नमस्ते जी,\n\n*K D Memorial School* की ओर से सादर प्रणाम।\n\nआपके बच्चे *${getVal(s, "NAME")}* (कक्षा ${getVal(s, "CLASS")}) का बकाया ₹${getNum(s, "BAL")} है।\n\nकृपया जल्द से जल्द बकाया राशि का भुगतान करें।\n\nधन्यवाद\nप्रबंधक - K D Memorial School`;
  
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// Bulk WhatsApp to all parents with pending dues
function sendBulkWA() {
  console.log("Total students:", students.length);
  
  // Get students with pending balance and valid phone
  const pendingStudents = students.filter(s => {
    const balance = getNum(s, "BAL");
    const phoneRaw = getVal(s, "PHONE");
    const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, "") : "";
    console.log("Student:", getVal(s, "NAME"), "Balance:", balance, "Phone:", phone);
    return balance > 0 && phone.length >= 10;
  });
  
  console.log("Pending students with phone:", pendingStudents.length);
  
  if (pendingStudents.length === 0) {
    alert("No students with pending dues and valid phone numbers found!\n\nMake sure:\n1. Students have balance > 0\n2. Phone numbers are saved in the sheet");
    return;
  }
  
  if (!confirm(`Send WhatsApp reminder to ${pendingStudents.length} parents with pending dues?`)) {
    return;
  }
  
  let count = 0;
  pendingStudents.forEach((s, index) => {
    setTimeout(() => {
      let phone = String(getVal(s, "PHONE")).replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;
      
      const msg = `Dear Parent,\n\nThis is a reminder from *K D Memorial School*.\nStudent: *${getVal(s, "NAME")}* (Class ${getVal(s, "CLASS")})\nPending Balance: *₹${getNum(s, "BAL")}*\n\nPlease pay the dues at the earliest.`;
      
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
      count++;
      
      if (index === pendingStudents.length - 1) {
        alert(`Sent ${count} WhatsApp messages!\n\nNote: Messages open in new tabs. Allow popups if they don't open.`);
      }
    }, index * 2000); // 2 second delay between messages
  });
}

// Send custom message to selected students
function sendCustomWA(message) {
  const pendingStudents = students.filter(s => getNum(s, "BAL") > 0 && getVal(s, "PHONE") && String(getVal(s, "PHONE")).length >= 10);
  
  if (pendingStudents.length === 0) {
    alert("No students with pending dues found!");
    return;
  }
  
  if (!message) {
    message = prompt("Enter your custom message (use {name} for student name, {balance} for amount):");
    if (!message) return;
  }
  
  let count = 0;
  pendingStudents.forEach((s, index) => {
    setTimeout(() => {
      let phone = String(getVal(s, "PHONE")).replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;
      
      let msg = message
        .replace(/{name}/g, getVal(s, "NAME"))
        .replace(/{balance}/g, getNum(s, "BAL"))
        .replace(/{class}/g, getVal(s, "CLASS"));
      
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
      count++;
      
      if (index === pendingStudents.length - 1) {
        alert(`Sent ${count} messages!`);
      }
    }, index * 2000);
  });
}

// ============================================
// Print
// ============================================

function printCurrent() {
  const s = CURRENT_STUDENT;
  if (!s) return;
  
  const printWindow = window.open("", "_blank");
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fee Receipt - ${s.Name}</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 600px; margin: 0 auto; border: 2px solid #000; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 20px; }
        .header h2 { margin: 0; text-transform: uppercase; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px; text-align: left; }
        th { border-top: 1px solid #000; border-bottom: 1px solid #000; }
        .text-right { text-align: right; }
        .total-row { border-top: 2px solid #000; font-size: 1.2em; }
        .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
        .sig-line { text-align: center; }
        @media print { body { border: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>K D Memorial Inter School</h2>
        <p>Bankata Kushinagar,  Pradesh</p>
274149, Uttar        <p><strong>FEE RECEIPT</strong></p>
      </div>
      <div class="info">
        <div>
          <div>Name: <strong>${s.Name}</strong></div>
          <div>Father: ${s.Father || ""}</div>
          <div>Class: ${s.Class}</div>
        </div>
        <div style="text-align:right;">
          <div>Date: ${new Date().toLocaleDateString()}</div>
          <div>Roll No: ${s.Roll}</div>
        </div>
      </div>
      <table>
        <tr><th>Description</th><th class="text-right">Amount</th></tr>
        <tr><td>Tuition Fee</td><td class="text-right">₹${Number(s.Tuition || 0).toLocaleString()}</td></tr>
        <tr><td>Van Fee</td><td class="text-right">₹${Number(s.Van || 0).toLocaleString()}</td></tr>
        <tr><td>Other / Exam</td><td class="text-right">₹${Number(s.Other || 0).toLocaleString()}</td></tr>
        <tr><td><strong>Total Dues</strong></td><td class="text-right"><strong>₹${Number(s.Total || 0).toLocaleString()}</strong></td></tr>
        <tr><td>Paid Amount</td><td class="text-right">₹${Number(s.Rec || 0).toLocaleString()}</td></tr>
        <tr class="total-row"><td><strong>BALANCE</strong></td><td class="text-right"><strong>₹${Number(s.Bal || 0).toLocaleString()}</strong></td></tr>
      </table>
      <div class="signatures">
        <div class="sig-line"><p>___________________</p><p>Signature</p></div>
        <div class="sig-line"><p>___________________</p><p>Office Stamp</p></div>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
}

// ============================================
// Day Book
// ============================================

async function loadDayBook() {
  // Get transactions
  const transactions = await gasGet(SHEETS.TRANSACTIONS);
  const today = new Date().toLocaleDateString();
  
  let totalIn = 0;
  const tbody = document.getElementById("daybook_body");
  tbody.innerHTML = "";
  
  transactions.forEach(t => {
    const date = new Date(t.Date);
    if (date.toLocaleDateString() === today) {
      totalIn += Number(t.Amount) || 0;
      const time = date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
      tbody.innerHTML += `<tr><td>${time}</td><td>${t.Name} (Roll ${t.Roll})</td><td>${t.Mode}</td><td style="color:green; font-weight:bold">+₹${Number(t.Amount).toLocaleString()}</td></tr>`;
    }
  });
  
  document.getElementById("day_in").innerText = "₹" + totalIn.toLocaleString();
  DAY_IN = totalIn;
  
  // Get expenses
  const expenses = await gasGet(SHEETS.EXPENSES);
  let totalOut = 0;
  
  expenses.forEach(e => {
    const date = new Date(e.Date);
    if (date.toLocaleDateString() === today) {
      totalOut += Number(e.Amount) || 0;
      tbody.innerHTML += `<tr><td>-</td><td>EXP: ${e.Category} - ${e.Description}</td><td>Cash</td><td style="color:red; font-weight:bold">-₹${Number(e.Amount).toLocaleString()}</td></tr>`;
    }
  });
  
  document.getElementById("day_out").innerText = "₹" + totalOut.toLocaleString();
  DAY_OUT = totalOut;
  
  document.getElementById("day_net").innerText = "₹" + (totalIn - totalOut).toLocaleString();
}

// ============================================
// Expenses
// ============================================

async function loadExpenses() {
  const expenses = await gasGet(SHEETS.EXPENSES);
  const tbody = document.getElementById("exp_body");
  
  // Sort by date descending
  expenses.sort((a, b) => new Date(b.Date) - new Date(a.Date));
  
  tbody.innerHTML = expenses.map(e => {
    const date = new Date(e.Date).toLocaleDateString();
    return `<tr><td>${date}</td><td>${e.Category}</td><td>${e.Description}</td><td style="color:red">₹${Number(e.Amount).toLocaleString()}</td></tr>`;
  }).join("");
}

async function submitExp() {
  const exp = {
    Date: new Date().toISOString(),
    Category: document.getElementById("exp_cat").value,
    Amount: Number(document.getElementById("exp_amt").value) || 0,
    Description: document.getElementById("exp_desc").value
  };
  
  if (!exp.Amount || exp.Amount <= 0) return alert("Enter valid amount");
  
  const result = await gasPost("create", SHEETS.EXPENSES, exp);
  
  if (result.success) {
    document.getElementById("expModal").style.display = "none";
    document.getElementById("exp_amt").value = "";
    document.getElementById("exp_desc").value = "";
    loadExpenses();
    loadDayBook();
  } else {
    alert("Error: " + (result.error || result.message));
  }
}

// ============================================
// Staff
// ============================================

async function loadStaff() {
  let staff = await gasGet(SHEETS.STAFF);
  
  // If no staff, create default
  if (!staff || staff.length === 0) {
    await gasPost("create", SHEETS.STAFF, { Name: "Teacher A", Role: "Faculty", Salary: 15000, Advance: 0 });
    staff = await gasGet(SHEETS.STAFF);
  }
  
  const tbody = document.getElementById("staff_body");
  tbody.innerHTML = staff.map(s => {
    const json = JSON.stringify(s).replace(/'/g, "'");
    return `
      <tr>
        <td><strong>${s.Name}</strong></td>
        <td>${s.Role}</td>
        <td>₹${Number(s.Salary || 0).toLocaleString()}</td>
        <td style="color:red">₹${Number(s.Advance || 0).toLocaleString()}</td>
        <td><button class="btn-primary" style="padding:4px 10px; font-size:0.8rem;" onclick='giveAdv(${json})'>Give Advance</button></td>
      </tr>
    `;
  }).join("");
}

async function giveAdv(s) {
  const amount = prompt("Enter Advance Amount for " + s.Name + ":");
  if (amount) {
    const newAdvance = Number(s.Advance || 0) + Number(amount);
    await gasPost("update", SHEETS.STAFF, { Advance: newAdvance }, s.id);
    
    // Also log as expense
    await gasPost("create", SHEETS.EXPENSES, {
      Date: new Date().toISOString(),
      Category: "Staff Advance",
      Amount: Number(amount),
      Description: "Advance to " + s.Name
    });
    
    alert("Advance Recorded");
    loadStaff();
  }
}

// Make functions available globally
window.switchView = switchView;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleFormSubmit = handleFormSubmit;
window.deleteRecord = deleteRecord;
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.openFeeModal = openFeeModal;
window.submitFee = submitFee;
window.sendWA = sendWA;
window.printCurrent = printCurrent;
window.sortData = sortData;
window.filterByClass = filterByClass;
window.loadDayBook = loadDayBook;
window.loadExpenses = loadExpenses;
window.submitExp = submitExp;
window.loadStaff = loadStaff;
window.giveAdv = giveAdv;
window.loadReports = loadReports;
window.exportToCSV = exportToCSV;
window.exportPendingDues = exportPendingDues;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.filterByBalance = filterByBalance;
window.sendBulkWA = openBulkWAModal;
window.sendCustomWA = sendCustomWA;
window.closeBulkWA = closeBulkWA;
window.toggleWAStudent = toggleWAStudent;
window.selectAllWA = selectAllWA;
window.deselectAllWA = deselectAllWA;
window.filterWASelection = filterWASelection;
window.sendSelectedWA = sendSelectedWA;

// ============================================
// Bulk WhatsApp Selection Modal Functions
// ============================================

let waSelectedStudents = [];

function openBulkWAModal() {
  // Get all students with valid phone numbers
  const studentsWithPhone = students.filter(s => {
    const phone = getVal(s, "PHONE");
    return phone && String(phone).replace(/\D/g, "").length >= 10;
  });
  
  if (studentsWithPhone.length === 0) {
    alert("No students with valid phone numbers found!");
    return;
  }
  
  waSelectedStudents = [];
  
  // Build the selection list
  const listEl = document.getElementById("waSelectionList");
  listEl.innerHTML = studentsWithPhone.map(s => {
    const phone = String(getVal(s, "PHONE")).replace(/\D/g, "");
    const balance = getNum(s, "BAL");
    return `
      <div style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #f1f5f9;" class="wa-item">
        <input type="checkbox" id="wa_${s.id}" value="${s.id}" onchange="toggleWAStudent(${s.id})" style="width:20px; height:20px;">
        <div style="flex:1;">
          <strong>${getVal(s, "NAME")}</strong> (${getVal(s, "CLASS")})<br>
          <span style="color:#64748b; font-size:0.85rem;">${phone} ${balance > 0 ? '- <span style="color:red">Balance: ₹' + balance + '</span>' : '<span style="color:green">Paid</span>'}</span>
        </div>
      </div>
    `;
  }).join("");
  
  document.getElementById("waSelectedCount").innerText = "0";
  document.getElementById("bulkWAModal").style.display = "flex";
}

function closeBulkWA() {
  document.getElementById("bulkWAModal").style.display = "none";
}

function toggleWAStudent(id) {
  const checkbox = document.getElementById("wa_" + id);
  if (checkbox.checked) {
    waSelectedStudents.push(id);
  } else {
    waSelectedStudents = waSelectedStudents.filter(sid => sid !== id);
  }
  document.getElementById("waSelectedCount").innerText = waSelectedStudents.length;
}

function selectAllWA() {
  waSelectedStudents = [];
  document.querySelectorAll('#waSelectionList input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
    waSelectedStudents.push(Number(cb.value));
  });
  document.getElementById("waSelectedCount").innerText = waSelectedStudents.length;
}

function deselectAllWA() {
  waSelectedStudents = [];
  document.querySelectorAll('#waSelectionList input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById("waSelectedCount").innerText = "0";
}

function filterWASelection() {
  const search = document.getElementById("waSearch").value.toLowerCase();
  document.querySelectorAll(".wa-item").forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(search) ? "flex" : "none";
  });
}

function sendSelectedWA() {
  // Get all students with phones - SIMPLER APPROACH
  const allWithPhone = students.filter(s => {
    // Get phone from any possible column
    const phone = s["Mobile"] || s["mobile"] || s["Phone"] || s["phone"] || "";
    const clean = String(phone).replace(/\D/g, "");
    return clean.length >= 10;
  });
  
  console.log("Students with phone:", allWithPhone.length);
  console.log("Sample:", allWithPhone[0]);
  
  if (allWithPhone.length === 0) {
    alert("No students with phone numbers found!\n\nCheck console for debug info.");
    return;
  }
  
  if (!confirm(`Send WhatsApp to ${allWithPhone.length} parents?`)) {
    return;
  }
  
  closeBulkWA();
  
  // Build links
  const links = allWithPhone.map(s => {
    const name = s["Student Name"] || "Student";
    const phoneRaw = s["Mobile"] || s["mobile"] || s["Phone"] || "";
    const phone = String(phoneRaw).replace(/\D/g, "");
    const fullPhone = phone.length === 10 ? "91" + phone : phone;
    const cls = s["Class"] || "";
    const bal = s["Balance"] || s["Bal"] || 0;
    
    const msg = `नमस्ते,\n\nके. डी. मेमोरियल स्कूल की ओर से सूचित किया जाता है।\n\nआपके बच्चे ${name} (कक्षा ${cls}) का शेष देनदारी Rs. ${bal} है।\n\nकृपया जल्द से जल्द बकाया राशि का भुगतान करें।\n\nधन्यवाद,\nके. डी. मेमोरियल स्कूल`;
    
    return {
      name: name,
      url: "https://wa.me/" + fullPhone + "?text=" + encodeURIComponent(msg)
    };
  });
  
  console.log("Links created:", links.length);
  
  // Create popup with auto-send
  const popup = window.open("", "_blank", "width=500,height=450");
  popup.document.write(`
    <html><head><title>WhatsApp Auto-Sender</title>
    <style>
      body{font-family:Arial;padding:20px;text-align:center;background:#f5f5f5}
      .btn{display:inline-block;padding:12px 20px;margin:8px;background:#25d366;color:white;text-decoration:none;border-radius:8px}
      .ctrl{padding:10px 20px;margin:5px;cursor:pointer;border:none;border-radius:5px;color:white}
      .start{background:#4f46e5}.stop{background:#ef4444}
      #status{font-size:16px;margin:15px 0;color:#4f46e5;font-weight:bold}
    </style>
    </head>
    <body>
      <h2>📱 WhatsApp Auto-Sender</h2>
      <p>${links.length} students with phones</p>
      <div id="status">Ready - Click Start</div>
      <button class="ctrl start" onclick="startAuto()">▶️ START AUTO-SEND</button>
      <button class="ctrl stop" onclick="stopAuto()">⏹️ STOP</button>
      <hr>
      ${links.map(l => `<a href="${l.url}" target="_blank" class="btn" id="btn${links.indexOf(l)}">📱 ${l.name}</a>`).join("")}
      <script>
        var idx = 0;
        var running = false;
        var timer = null;
        
        function startAuto() {
          if(running) return;
          running = true;
          idx = 0;
          sendNext();
        }
        
        function sendNext() {
          if(!running || idx >= ${links.length}) {
            document.getElementById('status').innerText = '✅ ALL DONE!';
            running = false;
            return;
          }
          
          document.getElementById('status').innerText = 'Sending ' + (idx+1) + ' of ${links.length}...';
          document.getElementById('btn'+idx).click();
          idx++;
          timer = setTimeout(sendNext, 2500);
        }
        
        function stopAuto() {
          running = false;
          clearTimeout(timer);
          document.getElementById('status').innerText = '⏹️ Stopped at ' + idx;
        }
      <\/script>
    </body></html>
  `);
  popup.document.close();
}

// Export new functions

// ============================================
// Reports - Financial Summaries
// ============================================

async function loadReports() {
  const tbody = document.getElementById("reports_body");
  if (!tbody) return;
  
  // Calculate class-wise summary
  const classData = {};
  students.forEach(s => {
    const cls = getVal(s, "CLASS") || "Unknown";
    if (!classData[cls]) {
      classData[cls] = { total: 0, collected: 0, pending: 0, students: 0 };
    }
    classData[cls].students++;
    classData[cls].total += getNum(s, "TOTAL");
    classData[cls].collected += getNum(s, "REC");
    classData[cls].pending += getNum(s, "BAL");
  });
  
  let html = `<table class="data-table"><thead><tr><th>Class</th><th>Students</th><th>Total Fee</th><th>Collected</th><th>Pending</th></tr></thead><tbody>`;
  
  Object.keys(classData).sort().forEach(cls => {
    const d = classData[cls];
    html += `<tr>
      <td><strong>${cls}</strong></td>
      <td>${d.students}</td>
      <td>₹${d.total.toLocaleString()}</td>
      <td style="color:green">₹${d.collected.toLocaleString()}</td>
      <td style="color:red">₹${d.pending.toLocaleString()}</td>
    </tr>`;
  });
  
  // Add totals row
  const totals = Object.values(classData).reduce((acc, d) => ({
    students: acc.students + d.students,
    total: acc.total + d.total,
    collected: acc.collected + d.collected,
    pending: acc.pending + d.pending
  }), { students: 0, total: 0, collected: 0, pending: 0 });
  
  html += `<tr style="background:#f1f5f9; font-weight:bold;">
    <td>TOTAL</td>
    <td>${totals.students}</td>
    <td>₹${totals.total.toLocaleString()}</td>
    <td style="color:green">₹${totals.collected.toLocaleString()}</td>
    <td style="color:red">₹${totals.pending.toLocaleString()}</td>
  </tr></tbody></table>`;
  
  tbody.innerHTML = html;
}

// ============================================
// Export to CSV
// ============================================

function exportToCSV() {
  const headers = ["Roll No.", "Class", "Student Name", "Father Name", "Mobile", "Email", "Total", "Received", "Balance"];
  const rows = students.map(s => [
    getVal(s, "ROLL"),
    getVal(s, "CLASS"),
    getVal(s, "NAME"),
    getVal(s, "FATHER"),
    getVal(s, "PHONE"),
    getVal(s, "EMAIL"),
    getNum(s, "TOTAL"),
    getNum(s, "REC"),
    getNum(s, "BAL")
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// Export pending dues list
function exportPendingDues() {
  const pending = students.filter(s => getNum(s, "BAL") > 0);
  const headers = ["Roll No.", "Class", "Student Name", "Father Name", "Mobile", "Balance"];
  const rows = pending.map(s => [
    getVal(s, "ROLL"),
    getVal(s, "CLASS"),
    getVal(s, "NAME"),
    getVal(s, "FATHER"),
    getVal(s, "PHONE"),
    getNum(s, "BAL")
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `pending_dues_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// ============================================
// Mobile Menu Functions
// ============================================

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
  }
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  }
}

// ============================================
// Update Window Exports
// ============================================
