// ============================================
// K D Memorial - GitHub App (GAS API Backend)
// ============================================

// CONFIG: Your Google Apps Script Web App URL
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxeKgAVnYTmcnf6pKtVZ8NcU1g8EMJx1X3Nsi86GaP15Ncu6rWXvzmmKvoq0b6Azr-j3w/exec";

// Sheet names
const SHEETS = {
  STUDENTS: "Sheet1",
  TRANSACTIONS: "Transactions",
  EXPENSES: "Expenses",
  STAFF: "Staff"
};

// Global state
let students = [];
let currentSort = { field: null, asc: true };
let CURRENT_STUDENT = null;
let DAY_IN = 0;
let DAY_OUT = 0;

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
  showProgress(80);
  renderDashboard();
  renderTable();
  renderVanTable();
  renderClassChips();
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
}

// ============================================
// Dashboard
// ============================================

function renderDashboard() {
  const totalStudents = students.length;
  let totalCollected = 0;
  let totalPending = 0;
  
  students.forEach(s => {
    const received = Number(s.Rec) || 0;
    const total = Number(s.Total) || 0;
    const balance = Number(s.Bal) || 0;
    totalCollected += received;
    totalPending += balance;
  });
  
  document.getElementById("kpiCount").innerText = totalStudents;
  document.getElementById("kpiCollected").innerText = "₹" + totalCollected.toLocaleString();
  document.getElementById("kpiPending").innerText = "₹" + totalPending.toLocaleString();
}

// ============================================
// Student Table
// ============================================

function renderClassChips() {
  const classes = [...new Set(students.map(s => s.Class).filter(Boolean))].sort();
  const container = document.getElementById("classChips");
  
  let html = `<div class="chip active" onclick="filterByClass('all', this)">All</div>`;
  classes.forEach(cls => {
    html += `<div class="chip" onclick="filterByClass('${cls}', this)">${cls}</div>`;
  });
  container.innerHTML = html;
}

function filterByClass(cls, chip) {
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  renderTable(cls);
}

function renderTable(filterClass = null) {
  let data = students;
  
  // Apply filter
  if (filterClass && filterClass !== "all") {
    data = data.filter(s => s.Class === filterClass);
  }
  
  // Apply sort
  if (currentSort.field) {
    data = [...data].sort((a, b) => {
      let va = a[currentSort.field];
      let vb = b[currentSort.field];
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
      (s.Name && s.Name.toLowerCase().includes(search)) ||
      (s.Roll && String(s.Roll).includes(search)) ||
      (s.Class && s.Class.toLowerCase().includes(search))
    );
  }
  
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = data.map(s => {
    const total = Number(s.Total) || 0;
    const balance = Number(s.Bal) || 0;
    return `
      <tr>
        <td>${s.Roll || ""}</td>
        <td><strong>${s.Name || ""}</strong></td>
        <td>${s.Class || ""}</td>
        <td>₹${total.toLocaleString()}</td>
        <td style="color: ${balance > 0 ? '#ef4444' : '#10b981'}">₹${balance.toLocaleString()}</td>
        <td>
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
  const vanStudents = students.filter(s => Number(s.Van) > 0);
  const tbody = document.getElementById("vanTableBody");
  
  document.getElementById("vanCount").innerText = vanStudents.length;
  const revenue = vanStudents.reduce((sum, s) => sum + (Number(s.Van) || 0), 0);
  document.getElementById("vanRevenue").innerText = "₹" + revenue.toLocaleString();
  
  tbody.innerHTML = vanStudents.map(s => {
    const balance = Number(s.Bal) || 0;
    return `
      <tr>
        <td>${s.Roll || ""}</td>
        <td><strong>${s.Name || ""}</strong></td>
        <td>${s.Class || ""}</td>
        <td>₹${Number(s.Van || 0).toLocaleString()}</td>
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
      document.getElementById("inpRoll").value = s.Roll || "";
      document.getElementById("inpClass").value = s.Class || "";
      document.getElementById("inpName").value = s.Name || "";
      document.getElementById("inpFather").value = s.Father || "";
      document.getElementById("inpPhone").value = s.Phone || "";
      document.getElementById("inpTuition").value = s.Tuition || 0;
      document.getElementById("inpVan").value = s.Van || 0;
      document.getElementById("inpOther").value = s.Other || 0;
      document.getElementById("inpPrev").value = s.PrevBal || 0;
      document.getElementById("inpRec").value = s.Rec || 0;
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
  const payload = {
    Roll: document.getElementById("inpRoll").value,
    Class: document.getElementById("inpClass").value,
    Name: document.getElementById("inpName").value,
    Father: document.getElementById("inpFather").value,
    Phone: document.getElementById("inpPhone").value,
    Tuition: Number(document.getElementById("inpTuition").value) || 0,
    Van: Number(document.getElementById("inpVan").value) || 0,
    Other: Number(document.getElementById("inpOther").value) || 0,
    PrevBal: Number(document.getElementById("inpPrev").value) || 0,
    Rec: Number(document.getElementById("inpRec").value) || 0
  };
  
  // Calculate total and balance
  payload.Total = payload.PrevBal + payload.Tuition + payload.Van + payload.Other;
  payload.Bal = payload.Total - payload.Rec;
  
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
  
  document.getElementById("avatarLetter").innerText = (s.Name || "S").charAt(0).toUpperCase();
  document.getElementById("pName").innerText = s.Name || "";
  document.getElementById("pClass").innerText = s.Class || "";
  document.getElementById("pRoll").innerText = s.Roll || "";
  document.getElementById("pFather").innerText = s.Father || "-";
  document.getElementById("pPhone").innerText = s.Phone || "-";
  document.getElementById("pLastRem").innerText = s.Reminder ? new Date(s.Reminder).toLocaleDateString() : "Never";
  
  const total = Number(s.Total) || 0;
  const received = Number(s.Rec) || 0;
  const balance = Number(s.Bal) || 0;
  
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
  
  document.getElementById("fee_name").innerText = CURRENT_STUDENT.Name;
  document.getElementById("fee_class").innerText = CURRENT_STUDENT.Class;
  document.getElementById("fee_bal").innerText = "₹" + (Number(CURRENT_STUDENT.Bal) || 0);
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
    Roll: s.Roll,
    Name: s.Name,
    Class: s.ClassVal || s.Class,
    Amount: amount,
    Mode: document.getElementById("fee_mode").value,
    Remarks: document.getElementById("fee_remarks").value
  };
  
  // Save to transactions sheet
  const result = await gasPost("create", SHEETS.TRANSACTIONS, txn);
  
  if (result.success) {
    // Update student record - add to received
    const newRec = Number(s.Rec || 0) + Number(amount);
    const newBal = Number(s.Total) - newRec;
    
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
// WhatsApp
// ============================================

function sendWA() {
  const s = CURRENT_STUDENT;
  if (!s) return alert("Error: No student selected.");
  
  let phone = String(s.Phone || "").replace(/\D/g, "");
  
  if (phone.length < 10) {
    alert("Invalid Phone Number: '" + s.Phone + "'\nPlease update it in the Edit menu.");
    return;
  }
  
  if (phone.length === 10) phone = "91" + phone;
  
  const msg = `Dear Parent,\n\nThis is a reminder from *K D Memorial School*.\nStudent: *${s.Name}* (Class ${s.Class})\nPending Balance: *₹${s.Bal}*\n\nPlease pay the dues at the earliest.`;
  
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
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
