# K D Memorial - GitHub App

A school fee management system hosted on GitHub Pages, using Google Sheets as the database.

## Setup Instructions

### 1. Deploy to GitHub Pages
1. Create a new repository on GitHub
2. Upload these files to the repository
3. Go to Settings → Pages
4. Select "main" branch and click Save
5. Your app will be available at `https://yourusername.github.io/repository-name`

### 2. Configure API URL
In `app.js`, update the `GAS_API_URL` constant with your Google Apps Script web app URL:

```javascript
const GAS_API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
```

### 3. Ensure Google Apps Script is Deployed
1. Open your Google Apps Script project
2. Click Deploy → New deployment
3. Select "Web app"
4. Set "Execute as" to "Me"
5. Set "Who has access" to "Anyone"
6. Click Deploy and copy the URL

## Features

- ✅ Student Database Management (CRUD)
- ✅ Fee Collection & Transactions
- ✅ Day Book (Daily Cash Flow)
- ✅ Expense Manager
- ✅ Staff Payroll
- ✅ WhatsApp Reminders
- ✅ Print Receipts

## Database Sheets Required

Ensure your Google Sheet has these sheets:
- **Sheet1** - Students data with columns: Roll, Class, Name, Father, PrevBal, Tuition, Van, Other, Total, Rec, Bal, Phone, Reminder
- **Transactions** - Fee transactions with columns: Date, Roll, Name, Class, Amount, Mode, Remarks
- **Expenses** - Expense records with columns: Date, Category, Amount, Description
- **Staff** - Staff records with columns: Name, Role, Salary, Advance

## License

MIT
