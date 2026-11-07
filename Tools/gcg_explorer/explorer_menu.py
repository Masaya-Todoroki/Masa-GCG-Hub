"""Install/remove per-user Windows Explorer right-click actions."""
from pathlib import Path
import sys

MENU_KEY = r'Software\Classes\SystemFileAssociations\.png\shell\GCGConvertWebP'
FOLDER_KEY = r'Software\Classes\Directory\shell\GCGConvertWebP'

def main():
    if sys.platform != 'win32':
        print('This installer only runs on Windows.')
        return 1
    import winreg
    action = sys.argv[1].lower() if len(sys.argv) > 1 else 'install'
    if action not in ('install', 'uninstall'):
        print('Usage: python explorer_menu.py [install|uninstall]')
        return 1
    if action == 'uninstall':
        for key in (MENU_KEY, FOLDER_KEY):
            for subkey in (key + r'\command', key):
                try:
                    winreg.DeleteKey(winreg.HKEY_CURRENT_USER, subkey)
                except FileNotFoundError:
                    pass
        print('Removed GCG Convert to WebP from Explorer.')
        return 0
    script = Path(__file__).with_name('quick_webp.py').resolve()
    python = Path(sys.executable).resolve()
    # Run via current Python installation; no admin rights needed.
    command = f'"{python}" "{script}" "%1"'
    for key, label in ((MENU_KEY, 'Convert to WebP (GCG)'), (FOLDER_KEY, 'Convert PNGs to WebP (GCG)')):
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key) as parent:
            winreg.SetValueEx(parent, '', 0, winreg.REG_SZ, label)
            winreg.SetValueEx(parent, 'Icon', 0, winreg.REG_SZ, str(python))
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key + r'\command') as cmd:
            winreg.SetValueEx(cmd, '', 0, winreg.REG_SZ, command)
    print('Installed Explorer right-click options for PNG files and folders.')
    print('Keep this tools folder in the same location after installation.')
    print('On Windows 11, use Show more options if needed.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
