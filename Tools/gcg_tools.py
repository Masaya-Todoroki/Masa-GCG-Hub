"""GCG Tools: image utilities and conservative website configuration editor."""
import json
import re
import shutil
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

BASE = Path(__file__).resolve().parent
SETTINGS_FILE = Path.home() / ".gcg_tools_settings.json"
CONFIGS = {
    'AA Pairings': ('js/GCG-AAPairings-config.js', 'pairings'),
    'GD Reveals': ('js/gdreveals-app.js', 'reveals'),
    'AA/SP Reveals': ('js/gdaasp-app.js', 'reveals'),
}

def read_sets(text, kind):
    if kind == 'pairings':
        m = re.search(r'\bconst\s+SET_CONFIG\s*=\s*\[([\s\S]*?)\]\s*;', text)
        if not m: raise ValueError('SET_CONFIG not found; this version is not supported.')
        entries = re.findall(r'\{\s*code\s*:\s*[\'"]([A-Za-z0-9_-]+)[\'"]\s*,\s*hidden\s*:\s*(true|false)\s*\}', m.group(1))
        if not entries: raise ValueError('Could not parse SET_CONFIG entries safely.')
        return [(code, hidden == 'true') for code, hidden in entries], None
    a = re.search(r'\bconst\s+SET_CODES\s*=\s*\[([^\]]*)\]\s*;', text)
    b = re.search(r'\bconst\s+DEFAULT_SET\s*=\s*[\'"]([A-Za-z0-9_-]+)[\'"]\s*;', text)
    if not a or not b: raise ValueError('SET_CODES / DEFAULT_SET not found; update this page to the dynamic-set version first.')
    codes = re.findall(r'[\'"]([A-Za-z0-9_-]+)[\'"]', a.group(1))
    if not codes: raise ValueError('No set codes found.')
    return [(code, False) for code in codes], b.group(1)

def write_sets(text, kind, sets, default):
    if kind == 'pairings':
        replacement = 'const SET_CONFIG = [\n' + ',\n'.join(f'    {{ code: "{code}", hidden: {str(hidden).lower()} }}' for code, hidden in sets) + '\n];'
        pattern = r'\bconst\s+SET_CONFIG\s*=\s*\[[\s\S]*?\]\s*;'
        updated, n = re.subn(pattern, lambda _: replacement, text, count=1)
    else:
        replacement = 'const SET_CODES = [' + ', '.join(json.dumps(code) for code, _ in sets) + '];'
        updated, n = re.subn(r'\bconst\s+SET_CODES\s*=\s*\[[^\]]*\]\s*;', lambda _: replacement, text, count=1)
        if n != 1: raise ValueError('Could not safely update SET_CODES.')
        updated, n = re.subn(r'\bconst\s+DEFAULT_SET\s*=\s*[\'"][A-Za-z0-9_-]+[\'"]\s*;', lambda _: f'const DEFAULT_SET = {json.dumps(default)};', updated, count=1)
    if n != 1: raise ValueError('Could not safely replace config.')
    return updated

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('GCG Tools')
        self.geometry('820x690')
        self.minsize(700, 560)
        self.site = tk.StringVar(value=self.restore_site_folder())
        self.folder = tk.StringVar()
        self.format = tk.StringVar(value='PNG')
        self.quality = tk.IntVar(value=90)
        self.page = tk.StringVar(value='AA Pairings')
        self.default = tk.StringVar()
        self.entries = []
        self.loaded_text = None
        self.loaded_path = None
        tabs = ttk.Notebook(self)
        tabs.pack(fill='both', expand=True, padx=12, pady=12)
        image_tab = ttk.Frame(tabs, padding=12)
        web_tab = ttk.Frame(tabs, padding=12)
        ps_tab = ttk.Frame(tabs, padding=12)
        tabs.add(image_tab, text='Image Tools')
        tabs.add(web_tab, text='Website Manager')
        tabs.add(ps_tab, text='Photoshop Export')
        self.build_images(image_tab)
        self.build_web(web_tab)
        self.build_ps(ps_tab)
        self.logbox = tk.Text(self, height=6, state='disabled', wrap='word')
        self.logbox.pack(fill='x', padx=12, pady=(0, 12))
        self.log('Ready. Select a folder or website directory to begin.')

    def log(self, msg):
        def add():
            self.logbox.configure(state='normal')
            self.logbox.insert('end', msg + '\n')
            self.logbox.see('end')
            self.logbox.configure(state='disabled')
        self.after(0, add)

    def restore_site_folder(self):
        try:
            settings = json.loads(SETTINGS_FILE.read_text(encoding='utf-8'))
            path = settings.get('website_folder', '')
            return path if path and Path(path).is_dir() else ''
        except (OSError, ValueError, TypeError):
            return ''

    def remember_site_folder(self):
        path = self.site.get().strip()
        if not path or not Path(path).is_dir():
            return
        try:
            SETTINGS_FILE.write_text(json.dumps({'website_folder': str(Path(path).resolve())}, indent=2), encoding='utf-8')
        except OSError as e:
            self.log(f'Could not remember website folder: {e}')

    def pick(self, var):
        p = filedialog.askdirectory(initialdir=var.get() if Path(var.get()).is_dir() else None)
        if p:
            var.set(p)
            if var is self.site:
                self.remember_site_folder()

    def folder_row(self, parent, var, label):
        frame = ttk.Frame(parent)
        frame.pack(fill='x', pady=6)
        ttk.Label(frame, text=label).pack(anchor='w')
        row = ttk.Frame(frame)
        row.pack(fill='x')
        ttk.Entry(row, textvariable=var).pack(side='left', fill='x', expand=True)
        ttk.Button(row, text='Browse...', command=lambda: self.pick(var)).pack(side='left', padx=(8,0))

    def build_images(self, parent):
        ttk.Label(parent, text='Batch image conversion', font=('', 13, 'bold')).pack(anchor='w')
        self.folder_row(parent, self.folder, 'Source folder (files in this folder only)')
        row = ttk.Frame(parent); row.pack(anchor='w', pady=6)
        ttk.Label(row, text='Convert to:').pack(side='left')
        ttk.Combobox(row, textvariable=self.format, values=['PNG','WEBP','JPEG'], width=10, state='readonly').pack(side='left', padx=8)
        ttk.Label(row, text='Quality (WebP/JPEG):').pack(side='left', padx=(14,4))
        ttk.Spinbox(row, from_=1, to=100, textvariable=self.quality, width=5).pack(side='left')
        ttk.Button(parent, text='Convert Images', command=self.convert).pack(anchor='w', pady=10)
        ttk.Separator(parent).pack(fill='x', pady=10)
        ttk.Label(parent, text='Rename extensions only', font=('', 13, 'bold')).pack(anchor='w')
        ttk.Label(parent, text='Changes .jpg/.jpeg filenames to .webp WITHOUT converting the underlying image.\nOnly use when the files already contain WebP data.').pack(anchor='w', pady=6)
        ttk.Button(parent, text='Rename JPG extensions to WEBP', command=self.rename).pack(anchor='w', pady=8)
        ttk.Label(parent, text='Conversions go into a PNG / WEBP / JPEG subfolder. Existing outputs are skipped.').pack(anchor='w', pady=12)

    def run_worker(self, fn):
        threading.Thread(target=fn, daemon=True).start()

    def convert(self):
        folder = Path(self.folder.get())
        if not folder.is_dir(): return messagebox.showerror('Folder', 'Select an existing folder first.')
        fmt = self.format.get(); quality = self.quality.get()
        def work():
            try:
                from PIL import Image, ImageOps
            except ImportError:
                self.log('Pillow is required: pip install pillow')
                return
            out = folder / fmt; out.mkdir(exist_ok=True)
            ext = '.jpg' if fmt == 'JPEG' else '.' + fmt.lower()
            count = skipped = 0
            for src in folder.iterdir():
                if not src.is_file() or src.suffix.lower() not in {'.jpg','.jpeg','.webp','.png','.bmp','.tif','.tiff','.gif'}: continue
                dst = out / (src.stem + ext)
                if dst.exists(): skipped += 1; continue
                try:
                    with Image.open(src) as im:
                        im = ImageOps.exif_transpose(im)
                        if fmt == 'JPEG':
                            if im.mode not in ('RGB','L'):
                                rgba = im.convert('RGBA'); bg = Image.new('RGB', rgba.size, 'white'); bg.paste(rgba, mask=rgba.getchannel('A')); im = bg
                            im.save(dst, format=fmt, quality=quality)
                        else:
                            im = im.convert('RGBA') if im.mode not in ('RGB','RGBA') else im
                            im.save(dst, format=fmt, **({'quality':quality} if fmt == 'WEBP' else {}))
                    count += 1
                    self.log(f'Converted {src.name}')
                except Exception as e: self.log(f'ERROR {src.name}: {e}')
            self.log(f'Done: {count} converted, {skipped} skipped → {out}')
        self.run_worker(work)

    def rename(self):
        folder = Path(self.folder.get())
        if not folder.is_dir(): return messagebox.showerror('Folder', 'Select an existing folder first.')
        files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in ('.jpg','.jpeg')]
        if not files: return messagebox.showinfo('No files', 'No JPG/JPEG files found.')
        if not messagebox.askyesno('Confirm extension rename', f'Rename {len(files)} JPG/JPEG extensions to WEBP?\n\nThis does NOT convert the image data.'): return
        changed = skipped = 0
        for p in files:
            target = p.with_suffix('.webp')
            if target.exists(): skipped += 1; continue
            try: p.rename(target); changed += 1
            except OSError as e: self.log(f'ERROR {p.name}: {e}')
        self.log(f'Renamed {changed} files; skipped {skipped} existing destinations.')

    def build_web(self, parent):
        ttk.Label(parent, text='Website set configuration', font=('', 13, 'bold')).pack(anchor='w')
        self.folder_row(parent, self.site, 'Website root folder (contains js/)')
        row = ttk.Frame(parent); row.pack(fill='x', pady=8)
        ttk.Label(row, text='Page:').pack(side='left')
        ttk.Combobox(row, textvariable=self.page, values=list(CONFIGS), state='readonly', width=22).pack(side='left', padx=8)
        ttk.Button(row, text='Load Configuration', command=self.load_page).pack(side='left')
        columns = ('set', 'hidden')
        self.tree = ttk.Treeview(parent, columns=columns, show='headings', height=10, selectmode='browse')
        self.tree.heading('set', text='Set'); self.tree.heading('hidden', text='Visibility')
        self.tree.column('set', width=140, anchor='center'); self.tree.column('hidden', width=140, anchor='center')
        self.tree.pack(fill='both', expand=True, pady=6)
        row = ttk.Frame(parent); row.pack(fill='x', pady=4)
        ttk.Button(row, text='Add Set', command=self.add_set).pack(side='left', padx=3)
        ttk.Button(row, text='Remove Selected', command=self.remove_set).pack(side='left', padx=3)
        ttk.Button(row, text='Move Up', command=lambda: self.move(-1)).pack(side='left', padx=3)
        ttk.Button(row, text='Move Down', command=lambda: self.move(1)).pack(side='left', padx=3)
        ttk.Button(row, text='Toggle Hidden', command=self.toggle).pack(side='left', padx=3)
        row2 = ttk.Frame(parent); row2.pack(fill='x', pady=8)
        ttk.Label(row2, text='Default set (Reveal pages):').pack(side='left')
        self.default_box = ttk.Combobox(row2, textvariable=self.default, state='readonly', width=12)
        self.default_box.pack(side='left', padx=8)
        ttk.Button(row2, text='Save Changes (creates backup)', command=self.save_page).pack(side='right')
        ttk.Label(parent, text='Supports the current SET_CONFIG and SET_CODES formats only. Other JS is preserved.').pack(anchor='w')

    def refresh_tree(self):
        for item in self.tree.get_children(): self.tree.delete(item)
        for code, hidden in self.entries: self.tree.insert('', 'end', values=(code, 'Hidden' if hidden else 'Public'))
        self.default_box.configure(values=[x[0] for x in self.entries])

    def load_page(self):
        rel, kind = CONFIGS[self.page.get()]
        path = Path(self.site.get()) / rel
        if not path.is_file(): return messagebox.showerror('Not found', f'Could not find:\n{path}\n\nSelect the site root containing the js folder.')
        try:
            text = path.read_text(encoding='utf-8-sig')
            entries, default = read_sets(text, kind)
        except Exception as e: return messagebox.showerror('Unsupported configuration', str(e))
        self.loaded_text = text; self.loaded_path = path; self.loaded_kind = kind
        self.entries = entries; self.default.set(default or '')
        self.refresh_tree(); self.remember_site_folder(); self.log(f'Loaded {path} ({len(entries)} sets)')

    def selected_index(self):
        selected = self.tree.selection()
        return self.tree.index(selected[0]) if selected else None

    def add_set(self):
        if self.loaded_text is None: return messagebox.showinfo('Load first', 'Load a page configuration first.')
        from tkinter import simpledialog
        code = simpledialog.askstring('Add set', 'Set code (e.g. GD07):', parent=self)
        if not code: return
        code = code.strip().upper()
        if not re.fullmatch(r'[A-Z0-9_-]+', code): return messagebox.showerror('Invalid code', 'Use letters, numbers, _ or - only.')
        if code in [x[0] for x in self.entries]: return messagebox.showwarning('Duplicate', 'That set already exists.')
        self.entries.append((code, self.loaded_kind == 'pairings'))
        self.refresh_tree()

    def remove_set(self):
        i = self.selected_index()
        if i is None: return
        if len(self.entries) <= 1: return messagebox.showwarning('Required', 'Keep at least one set.')
        removed = self.entries.pop(i)
        if self.default.get() == removed[0]: self.default.set(self.entries[0][0])
        self.refresh_tree()

    def toggle(self):
        i = self.selected_index()
        if i is None: return
        if self.loaded_kind != 'pairings': return messagebox.showinfo('Not supported', 'Hidden-set toggle is only configured for AA Pairings.')
        code, hidden = self.entries[i]; self.entries[i] = (code, not hidden)
        self.refresh_tree(); self.tree.selection_set(self.tree.get_children()[i])

    def move(self, offset):
        i = self.selected_index()
        if i is None or not 0 <= i + offset < len(self.entries): return
        self.entries[i], self.entries[i + offset] = self.entries[i + offset], self.entries[i]
        self.refresh_tree(); self.tree.selection_set(self.tree.get_children()[i + offset])

    def save_page(self):
        if self.loaded_path is None: return messagebox.showwarning('Load first', 'Load a page configuration first.')
        codes = [x[0] for x in self.entries]
        default = self.default.get()
        if self.loaded_kind == 'reveals' and default not in codes: return messagebox.showerror('Default set', 'Choose a default set from the list.')
        try:
            current = self.loaded_path.read_text(encoding='utf-8-sig')
            if current != self.loaded_text:
                return messagebox.showerror('File changed', 'This JS file has changed since loading. Reload before saving to avoid overwriting edits.')
            updated = write_sets(current, self.loaded_kind, self.entries, default)
            if updated == current: return messagebox.showinfo('No changes', 'The configuration is already up to date.')
            stamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            # Keep backups outside the website's live JS directory.
            backup_dir = Path(self.site.get()) / 'Backups' / 'js'
            backup_dir.mkdir(parents=True, exist_ok=True)
            backup = backup_dir / (self.loaded_path.name + '.' + stamp + '.bak')
            shutil.copy2(self.loaded_path, backup)
            try:
                self.loaded_path.write_text(updated, encoding='utf-8')
            except Exception:
                shutil.copy2(backup, self.loaded_path)
                raise
            self.loaded_text = updated
            self.log(f'Saved {self.loaded_path}; backup: {backup}')
            messagebox.showinfo('Saved', f'Configuration saved.\nBackup: {backup}')
        except Exception as e: messagebox.showerror('Save failed', str(e))

    def build_ps(self, parent):
        ttk.Label(parent, text='Photoshop card layer exporter', font=('', 13, 'bold')).pack(anchor='w')
        ttk.Label(parent, text='Uses your original Export_Card_Group_WebP.jsx script.\nOpen a PSD in Photoshop, select a card group, then run the script.').pack(anchor='w', pady=12)
        ttk.Button(parent, text='Open Script Folder', command=lambda: subprocess.Popen(['explorer', str(BASE)]) if sys.platform == 'win32' else self.log(str(BASE))).pack(anchor='w', pady=5)
        ttk.Button(parent, text='Launch Photoshop Script...', command=self.launch_ps).pack(anchor='w', pady=5)
        ttk.Label(parent, text='Photoshop must be installed. If automatic launching fails, use File → Scripts → Browse in Photoshop.').pack(anchor='w', pady=10)

    def launch_ps(self):
        jsx = BASE / 'Export_Card_Group_WebP.jsx'
        if not jsx.exists(): return messagebox.showerror('Missing script', f'Not found: {jsx}')
        if sys.platform != 'win32': return messagebox.showinfo('Photoshop', f'In Photoshop, use File → Scripts → Browse and select:\n{jsx}')
        try:
            import os
            os.startfile(str(jsx))
            self.log('Opened JSX using Windows file association.')
        except OSError as e:
            messagebox.showinfo('Open in Photoshop', f'Windows could not launch the script automatically ({e}).\n\nIn Photoshop: File → Scripts → Browse\nSelect {jsx}')

if __name__ == '__main__':
    App().mainloop()
