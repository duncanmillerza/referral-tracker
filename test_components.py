import json
import gspread
from google.oauth2.service_account import Credentials

def test_sheet_connection():
    try:
        # Replace with your actual Sheet ID
        SHEET_ID = "18b5tDHMLivTHYVEi9yXXzvUQxy2ycUa_cDLBD5xgAB4"  # ⚠️ You need to replace this!
        
        print("🔗 Attempting to connect to Google Sheets...")
        
        # Test basic connection
        gc = gspread.service_account(filename='service-account.json')
        sheet = gc.open_by_key(SHEET_ID).sheet1
        
        print("✅ Successfully connected to Google Sheets")
        
        # Test reading headers
        headers = sheet.row_values(1)
        print(f"📋 Sheet headers: {headers}")
        
        # Test writing a row
        test_row = [
            '2025-09-05 14:30:00',  # Timestamp
            'TestPatient',           # Patient Surname
            'Test Ward',            # Ward
            '99',                   # Bed Number
            'Dr. Test',             # Referring Clinician
            'Emergency',            # Department From
            'Cardiology',           # Department To
            'Medium',               # Urgency Level
            'Test referral notes',  # Referral Notes
            '',                     # Clinician Seen
            '',                     # Time Seen
            ''                      # Clinician Notes
        ]
        
        print("📝 Adding test row...")
        sheet.append_row(test_row)
        print("✅ Successfully added test row")
        
        # Test reading all records
        records = sheet.get_all_records()
        print(f"📊 Total records in sheet: {len(records)}")
        
        if records:
            print("🔍 Last record:", records[-1])
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Starting Google Sheets API test...")
    test_sheet_connection()
    print("✨ Test complete!")