export class OsUtils {
  static isMac(): boolean {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }

  static formatShortcut(keys: string[]): string {
    const isMac = this.isMac();
    return keys.map(key => {
      const lower = key.toLowerCase();
      if (lower === 'mod' || lower === 'ctrl' || lower === 'cmd') {
        return isMac ? '⌘' : 'Ctrl';
      }
      if (lower === 'alt' || lower === 'opt') {
        return isMac ? '⌥' : 'Alt';
      }
      if (lower === 'shift') {
        return isMac ? '⇧' : 'Maj';
      }
      if (lower === 'enter') {
        return '↵';
      }
      return key.toUpperCase();
    }).join(isMac ? '' : ' + ');
  }
}
