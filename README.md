# Trial Data Tool v2

Professional field trial data collection and analysis application with modular architecture.

## Features

✅ **Multi-trial management** with auto-save  
✅ **Randomized Complete Block Design (RCBD)**  
✅ **Adjustable trial layout** with drag & drop  
✅ **Field orientation compass** (5° increments)  
✅ **Color-coded data entry** based on actual values  
✅ **Photo uploads** per plot  
✅ **Assessment notes** with voice recording placeholder  
✅ **Advanced statistics** - ANOVA, F-tests, Fisher's LSD  
✅ **Box plots** showing all dates  
✅ **CSV export** (raw data & summary tables)  
✅ **JSON backup/restore**  
✅ **Offline capable** (browser localStorage)  
✅ **Mobile-optimized** for field use  
✅ **Database-ready** architecture  

## Quick Start

### 1. Clone or Download
```bash
git clone https://github.com/YOUR_USERNAME/trial-data-tool-v2.git
cd trial-data-tool-v2
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Open in Browser
Navigate to `http://localhost:3000`

## Project Structure

```
trial-data-tool-v2/
├── package.json              # Dependencies & scripts
├── index.html                # HTML entry point
├── vite.config.js            # Build configuration
├── tailwind.config.js        # Tailwind CSS config
└── src/
    ├── main.jsx              # React entry point
    ├── index.css             # Global styles
    ├── App.jsx               # Main coordinator (~150 lines)
    └── components/
        ├── TrialLibrary.jsx       # Library view
        ├── TrialSetup.jsx         # Setup form
        ├── TrialLayoutEditor.jsx  # Layout builder
        ├── DateNavigation.jsx     # Date selector
        ├── DataEntry.jsx          # Data entry coordinator
        ├── DataEntryField.jsx     # Field map view
        ├── DataEntryTable.jsx     # Table view
        ├── DataEntryNotes.jsx     # Notes & photos
        └── Analysis.jsx           # Advanced statistics
```

## Key Dependencies

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **simple-statistics** - ANOVA, t-tests, confidence intervals
- **jstat** - Statistical distributions, F-tests, p-values

## Usage

### Create a New Trial
1. Click "Create New Trial"
2. Enter trial name, blocks, treatments
3. Add assessment types with min/max scales
4. Generate trial layout

### Adjust Layout
1. Drag plots to rearrange within blocks
2. Add blanks for unsuitable areas (+)
3. Remove blanks (−)
4. Adjust field orientation (compass)
5. Randomize blocks individually or all
6. Finalize & lock layout

### Data Entry
1. Add assessment dates
2. Choose assessment type
3. Enter data in:
   - **Field Map** - Visual grid with color coding
   - **Table View** - Spreadsheet style
   - **Notes** - Photos and observations

### Analysis
- View treatment means ± standard errors
- ANOVA with F-tests and p-values
- Fisher's LSD multiple comparisons
- Box plots across all dates
- Letter groupings for significance

### Export Data
- **Export Data** - Raw CSV with all values
- **Export Summary** - Treatment means with SE
- **Backup Trial** - Complete JSON file

## Database Integration (Phase 2)

The app is structured for easy database integration:

### Data Structure
All trial data is stored in clean JSON format:
```json
{
  "id": "1234567890",
  "name": "Trial Name",
  "config": { ... },
  "gridLayout": [ ... ],
  "assessmentDates": [ ... ],
  "photos": { ... },
  "notes": { ... }
}
```

### Ready for:
- Supabase
- Firebase
- REST API
- PostgreSQL
- Any JSON-based database

### Integration Points
Replace `localStorage` calls in `App.jsx` with:
- `POST /api/trials` - Create trial
- `GET /api/trials` - List trials
- `GET /api/trials/:id` - Load trial
- `PUT /api/trials/:id` - Update trial
- `DELETE /api/trials/:id` - Delete trial

## Future Features (Phase 2+)

🔄 **Cloud database** with Supabase  
👥 **Multi-user sync**  
🎤 **AI note transcription**  
👁️ **Client portal** (read-only access)  
📊 **Advanced reporting**  
📱 **Native mobile apps**  

## Development

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Deploy
The app can be deployed to:
- Vercel (recommended)
- Netlify
- GitHub Pages
- Any static hosting

## License

Proprietary - Internal Use Only

## Support

For issues or questions, contact your development team.
