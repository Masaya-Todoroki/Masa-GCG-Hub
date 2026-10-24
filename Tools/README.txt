GCG Tools (Windows)
===================
1. Install Python 3.10+ if needed (enable Add Python to PATH).
2. Double-click Launch_GCG_Tools.bat.
3. Select a folder for image tools or your website root for Website Manager.
4. Website Manager supports:
   js/GCG-AAPairings-config.js (SET_CONFIG: code + hidden)
   js/gdreveals-app.js (SET_CODES + DEFAULT_SET)
   js/gdaasp-app.js (SET_CODES + DEFAULT_SET)
   Reveal pages need the updated dynamic-set scripts.
5. Load the page, change the set list, and Save Changes.
   Every save makes a timestamped .bak backup beside the JS file.
   It will refuse to save if the file changed externally since loading.
6. Photoshop Export uses the original JSX file. In Photoshop, File > Scripts > Browse.

IMPORTANT: Changing a set list does not create the image/CSV files for that set.
Extension renaming does NOT convert image data. Use Image Converter for real conversion.
The app edits only supported JS config patterns and does not rewrite other JS.

Optional standalone EXE packaging (on Windows):
  pip install pyinstaller pillow
  pyinstaller --noconfirm --onefile --windowed --add-data "Export_Card_Group_WebP.jsx;." gcg_tools.py
Note: for a packaged EXE, the Photoshop JSX is best kept beside the EXE.

Website Manager backups are saved to <website root>/Backups/js/ (timestamped .bak files).
Consider excluding Backups/ from your website deployment.

Website Manager remembers the last selected website root folder across launches.
The preference is stored in your Windows user home folder as .gcg_tools_settings.json.
The Image Tools source folder is not remembered.
