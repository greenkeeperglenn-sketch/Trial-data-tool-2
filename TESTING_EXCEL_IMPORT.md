# Excel Import Feature - Testing Guide

## To Test the Excel Import Feature

### Option 1: Development Mode (Recommended)
1. Open terminal in the project folder
2. Run: `npm run dev`
3. Open http://localhost:3000 in your browser
4. Click "Import from Excel" button
5. Select your Excel file

### Option 2: Production Build
1. Open terminal in the project folder
2. Run: `npm run build`
3. Run: `npm run preview`
4. Open the URL shown in your browser
5. Click "Import from Excel" button
6. Select your Excel file

## What to Expect

When you import an Excel file, you should see:
1. **Preview screen** showing:
   - Trial name
   - Number of blocks and treatments
   - Assessment types found
   - Assessment dates found

2. **Import button** - Click to import the trial

3. **Trial Library** - The imported trial appears in your library

## Debugging

If you see errors, open the browser console (F12) and look for:
- `[Parser]` logs - Shows parsing progress
- `[createGridLayout]` logs - Shows grid creation
- `[App]` logs - Shows import process

Any red error messages - share these with me!

## Files That Work

These sample files are included and should work:
- `STRI DS Curative Assessment sheet.xlsx` (14 assessment dates)
- `Internal WA Assessment Sheet.xlsx` (15 assessment dates)

Both files have been tested and parse successfully.
