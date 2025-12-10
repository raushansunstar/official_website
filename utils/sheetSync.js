
import { google } from 'googleapis';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const TARGET_GID = '1770338648'; // The specific tab ID provided
const SERVICE_ACCOUNT_FILE = path.join(__dirname, '../service-account.json');

// Initialize Auth
const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Finds the sheet title for a given GID
 */
async function getSheetNameByGid(gid) {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const sheet = response.data.sheets.find(
            (s) => s.properties.sheetId.toString() === gid.toString()
        );

        return sheet ? sheet.properties.title : null;
    } catch (error) {
        console.error('Error fetching spreadsheet details:', error);
        return null;
    }
}

/**
 * Appends a user to the Google Sheet
 * @param {Object} user - The user object
 */
// Helper to get letter from index (0 -> A, 1 -> B, etc.)
const getColumnLetter = (colIndex) => {
    let temp, letter = '';
    while (colIndex >= 0) {
        temp = (colIndex % 26);
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
};

/**
 * Appends or Updates a user in the Google Sheet
 * @param {Object} user - The user object
 */
export const syncUserToSheet = async (user) => {
    try {
        if (!SPREADSHEET_ID) {
            console.error('SPREADSHEET_ID is missing in .env');
            return;
        }

        const sheetName = await getSheetNameByGid(TARGET_GID);
        if (!sheetName) {
            console.error(`Could not find sheet with GID: ${TARGET_GID}`);
            return;
        }

        // 1. Fetch all existing data to check for duplicates (Column A = Email usually)
        const readResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!A:E`, // Assuming A=Email
        });

        const rows = readResponse.data.values || [];
        const { email, firstName, lastName, phone, role, updatedAt, name } = user;
        // Handle both user (firstName/lastName) and agent (name) models
        const fullName = name ? name : `${firstName || ''} ${lastName || ''}`.trim();

        // Proper Date Formatting (DD/MM/YYYY, h:mm:ss a)
        const dateObj = updatedAt ? new Date(updatedAt) : new Date();
        const updatedStr = dateObj.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const userEmail = email ? String(email).toLowerCase().trim() : '';
        const userRole = role ? String(role).toLowerCase().trim() : 'user';

        if (!userEmail) return;

        // Check if Email AND Role combination exists
        // row[0] is Email, row[3] is Role (based on append order below)
        const rowIndex = rows.findIndex(row => {
            const rowEmail = row[0] ? String(row[0]).toLowerCase().trim() : '';
            const rowRole = row[3] ? String(row[3]).toLowerCase().trim() : 'user';
            return rowEmail === userEmail && rowRole === userRole;
        });

        const newRow = [
            userEmail,
            fullName,
            phone || '',
            userRole,
            updatedStr
        ];

        if (rowIndex !== -1) {
            // ✅ UPDATE existing row (same Email + same Role)
            const sheetRowNumber = rowIndex + 1;

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheetName}'!A${sheetRowNumber}:E${sheetRowNumber}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [newRow] }
            });

            console.log(`Successfully UPDATED ${userRole} ${userEmail} at row ${sheetRowNumber} in sheet: ${sheetName}`);
        } else {
            // ✅ APPEND new row (New Email OR Same Email but Diff Role)
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheetName}'!A:E`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [newRow] },
            });

            console.log(`Successfully APPENDED ${userRole} ${userEmail} to sheet: ${sheetName}`);
        }
    } catch (error) {
        console.error('Error syncing user to sheet:', error);
    }
};
