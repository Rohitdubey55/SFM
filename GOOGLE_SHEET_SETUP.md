# Google Sheet Structure - Optimized Setup

## 📊 Recommended Sheet Organization

Create a Google Sheet with the following tabs and columns:

---

### 1. Sheet1 - Students Database

| Column | Header Name | Purpose | Data Type |
|--------|-------------|---------|------------|
| A | Roll No. | Student roll number | Number |
| B | Class | Class/Section (e.g., 6th-A, 7th-B) | Text |
| C | Student Name | Full name | Text |
| D | Father Name | Parent's name | Text |
| E | Mobile | Parent phone number | Number (10 digits) |
| F | Email | Parent email (optional) | Text |
| G | Address | Student address | Text |
| H | Date of Birth | DOB | Date |
| I | Admission Date | When admitted | Date |
| J | Balance Upto Dec 2025 | Previous balance | Number |
| K | Fee Dec-March | Tuition fee | Number |
| L | Van Fee Upto March | Transport fee | Number |
| M | Ot (Exam-200,R-Card-200) | Other charges | Number |
| N | Total | Total fee (formula) | Number |
| O | Rec. | Amount received | Number |
| P | Balance | Due amount (formula) | Number |
| Q | Route No. | Van route (optional) | Text |
| R | Pickup Point | Van pickup location | Text |
| S | Last Payment Date | When last paid | Date |
| T | Last Reminder | Last WhatsApp sent | Date |
| U | Receipt No. | Auto-increment receipt | Number |

---

### 2. Transactions - Fee Collection History

| Column | Header Name | Purpose |
|--------|-------------|---------|
| A | Date | Transaction date |
| B | Receipt No. | Auto-generated receipt |
| C | Roll No. | Student roll |
| D | Name | Student name |
| E | Class | Student class |
| F | Amount | Amount paid |
| G | Mode | Cash/UPI/Bank Transfer |
| H | Remarks | Any notes |

---

### 3. Expenses - Expense Records

| Column | Header Name | Purpose |
|--------|-------------|---------|
| A | Date | Expense date |
| B | Category | Type (Transport/Office/Maintenance/Salary/Other) |
| C | Description | Details |
| D | Amount | Expense amount |
| E | Payment Mode | Cash/UPI/Bank |
| F | Approved By | Who approved |

---

### 4. Staff - Staff Management

| Column | Header Name | Purpose |
|--------|-------------|---------|
| A | Name | Staff name |
| B | Role | Designation |
| C | Salary | Monthly salary |
| D | Advance Taken | Advance given |
| E | Phone | Contact number |
| F | DOJ | Date of joining |

---

## 🔧 Important Formulas for Sheet1

### Column N (Total) - Formula:
```
=J+K+L+M
```

### Column P (Balance) - Formula:
```
=N-O
```

### Column U (Receipt No.) - Formula (Auto-increment):
```
=ROW()-1
```

---

## ⚠️ Important Notes

1. **First row must contain headers** - The app reads row 1 as column names
2. **Don't leave empty rows** - Keep data continuous
3. **Phone numbers** - Store as numbers without +91
4. **Date format** - Use YYYY-MM-DD or MM/DD/YYYY

---

## 📱 Mobile Accessibility Features Added

1. **Hamburger Menu** - Collapsible sidebar on mobile
2. **Responsive Tables** - Horizontal scroll on small screens
3. **Touch-friendly Buttons** - Minimum 44px touch targets
4. **Bottom Navigation** - Optional mobile nav bar
5. **Larger Fonts** - Better readability on phones

---

## 🆕 New Features Added

1. **Bulk WhatsApp** - Send reminders to all parents with dues
2. **Receipt Numbering** - Auto-generated unique receipts
3. **Financial Reports** - Monthly/Yearly collection reports
4. **Export to CSV** - Download student data
5. **Quick Filters** - Filter by balance status
6. **Payment History** - View all transactions per student
