import gspread
from google.oauth2.service_account import Credentials

# Load credentials
gc = gspread.service_account(filename='service-account.json')
sheet = gc.open_by_key('18b5tDHMLivTHYVEi9yXXzvUQxy2ycUa_cDLBD5xgAB4').sheet1

# Test write
sheet.append_row(['Test', 'Data', 'From', 'Python'])
print("Success! Check your Google Sheet.")